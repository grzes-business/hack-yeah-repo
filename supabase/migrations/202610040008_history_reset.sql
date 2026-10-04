-- Clean-slate control. Apply once after 001–007. This defines reset; it does NOT run it.
begin;
create table public.reset_conversation_ids (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 primary key(user_id,id)
);
alter table public.reset_conversation_ids enable row level security;
revoke all on public.reset_conversation_ids from public,anon,authenticated;
grant all on public.reset_conversation_ids to service_role;
-- Old transcript recovery queues must not resurrect a deleted conversation.
create function public.reject_reset_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.reset_conversation_ids where user_id=NEW.user_id and id=NEW.id) then raise exception 'This conversation was cleared; start a new conversation'; end if;
 return NEW;
end $$;
revoke all on function public.reject_reset_conversation() from public,anon,authenticated;
create trigger reject_cleared_conversation before insert or update on public.conversations for each row execute function public.reject_reset_conversation();
create function public.reset_owned_history(p_owner uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or not exists(select 1 from public.profiles where user_id=p_owner) then raise exception 'Owned profile required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':daily-inputs',0));
 insert into public.reset_conversation_ids(user_id,id) select user_id,id from public.conversations where user_id=p_owner on conflict do nothing;
 delete from public.subjective_events where user_id=p_owner;
 delete from public.conversations where user_id=p_owner;
 -- Cascades remove turns, capture revisions and voice processing receipts.
 delete from public.metric_samples where user_id=p_owner;
 delete from public.morning_checkins where user_id=p_owner;
 delete from public.daily_features where user_id=p_owner;
 delete from public.relationship_results where user_id=p_owner;
 -- Retain a monotonically increasing generation, even for an already-empty reset.
 insert into public.feature_input_generations(user_id,generation) values(p_owner,1)
 on conflict(user_id) do update set generation=public.feature_input_generations.generation+1,changed_at=now();
end $$;
revoke all on function public.reset_owned_history(uuid) from public,anon,authenticated;
grant execute on function public.reset_owned_history(uuid) to service_role;
commit;
