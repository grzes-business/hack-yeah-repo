-- Durable app-controlled voice processing receipts. Apply after migrations 001–004.
begin;
create table public.voice_turn_runs (
 user_id uuid not null references auth.users(id) on delete cascade,
 turn_id text not null,
 transcript text not null,
 target_root_id text,
 target_revision integer,
 plan jsonb,
 result jsonb,
 lease_token uuid,
 lease_until timestamptz,
 primary key(user_id,turn_id),
 foreign key(user_id,turn_id) references public.conversation_turns(user_id,id) on delete cascade,
 foreign key(user_id,target_root_id) references public.conversation_turns(user_id,id) on delete cascade
);
alter table public.voice_turn_runs enable row level security;
revoke all on public.voice_turn_runs from public,anon,authenticated;
grant select on public.voice_turn_runs to authenticated;
grant all on public.voice_turn_runs to service_role;
create policy owner_read on public.voice_turn_runs for select to authenticated using ((select auth.uid())=user_id);
create function public.claim_voice_turn(p_turn text,p_token uuid,p_target text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t public.conversation_turns; j public.voice_turn_runs; rev integer;
begin
 if u is null or p_token is null then raise exception 'Authentication and token required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':voice:'||p_turn,0));
 select * into t from public.conversation_turns where user_id=u and id=p_turn and role='user';
 if not found or not exists(select 1 from public.conversations where user_id=u and id=t.conversation_id and mode='capture') then raise exception 'Owned capture turn required'; end if;
 select * into j from public.voice_turn_runs where user_id=u and turn_id=p_turn for update;
 if found then
  if j.transcript is distinct from t.transcript then raise exception 'Transcript changed'; end if;
  if j.result is not null then return jsonb_build_object('state','cached','job',to_jsonb(j)); end if;
  if j.lease_until>now() then return jsonb_build_object('state','busy'); end if;
 else
  if p_target is not null then
   if p_target=p_turn then raise exception 'Invalid follow-up root'; end if;
   select revision into rev from public.turn_extractions where user_id=u and root_turn_id=p_target and extractor_version='capture-v1' and result is not null and lease_token is null;
   if not found then raise exception 'Completed owned target required'; end if;
  end if;
  insert into public.voice_turn_runs(user_id,turn_id,transcript,target_root_id,target_revision)
  values(u,p_turn,t.transcript,p_target,rev);
 end if;
 update public.voice_turn_runs set lease_token=p_token,lease_until=now()+interval '120 seconds'
 where user_id=u and turn_id=p_turn returning * into j;
 return jsonb_build_object('state','ready','job',to_jsonb(j));
end $$;
create function public.plan_voice_turn(p_turn text,p_token uuid,p_plan jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); j public.voice_turn_runs;
begin
 if u is null or p_token is null then raise exception 'Authentication and token required'; end if;
 select * into j from public.voice_turn_runs where user_id=u and turn_id=p_turn for update;
 if not found or j.lease_token is distinct from p_token or j.lease_until is null or j.lease_until<=now() then raise exception 'Voice lease expired'; end if;
 if j.plan is null then
  if jsonb_typeof(p_plan) is distinct from 'object' then raise exception 'Invalid voice plan'; end if;
  update public.voice_turn_runs set plan=p_plan where user_id=u and turn_id=p_turn returning * into j;
 end if;
 return j.plan;
end $$;
create function public.finish_voice_turn(p_turn text,p_token uuid,p_result jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); j public.voice_turn_runs;
begin
 if u is null or p_token is null then raise exception 'Authentication and token required'; end if;
 select * into j from public.voice_turn_runs where user_id=u and turn_id=p_turn for update;
 if not found or j.lease_token is distinct from p_token or j.lease_until<=now() then raise exception 'Voice lease expired'; end if;
 if p_result->>'turnId' is distinct from p_turn or p_result->>'disposition' is null or p_result->>'disposition' not in ('capture','followup','retrieval','conversation','ignore','cancel') then raise exception 'Invalid receipt'; end if;
 update public.voice_turn_runs set result=p_result,lease_token=null,lease_until=null where user_id=u and turn_id=p_turn returning * into j;
 return j.result;
end $$;
create function public.release_voice_turn(p_turn text,p_token uuid)
returns void language sql security definer set search_path='' as $$
 update public.voice_turn_runs set lease_until=now() where user_id=auth.uid() and turn_id=p_turn and lease_token=p_token;
$$;
revoke all on function public.claim_voice_turn(text,uuid,text),public.plan_voice_turn(text,uuid,jsonb),public.finish_voice_turn(text,uuid,jsonb),public.release_voice_turn(text,uuid) from public,anon;
grant execute on function public.claim_voice_turn(text,uuid,text),public.plan_voice_turn(text,uuid,jsonb),public.finish_voice_turn(text,uuid,jsonb),public.release_voice_turn(text,uuid) to authenticated;
commit;
