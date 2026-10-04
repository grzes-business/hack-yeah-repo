-- Stage 6. Apply once after 001–006. Owner RPCs cannot write derived rows.
begin;
create table public.feature_input_generations (
 user_id uuid primary key references auth.users(id) on delete cascade,
 generation bigint not null default 0 check (generation>=0),
 changed_at timestamptz not null default now()
);
alter table public.feature_input_generations enable row level security;
revoke all on public.feature_input_generations from public,anon,authenticated;
grant select on public.feature_input_generations to authenticated;
grant all on public.feature_input_generations to service_role;
create policy owner_read on public.feature_input_generations for select to authenticated using ((select auth.uid())=user_id);
alter table public.daily_features add column input_generation bigint;
alter table public.relationship_results add column input_generation bigint;
-- NULL marks pre-generation rows stale. Global invalidation also covers lagged consumers.
create function public.invalidate_feature_inputs() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if TG_OP='UPDATE' then
  if OLD.user_id<>NEW.user_id then raise exception 'Raw ownership cannot change'; end if;
  if TG_TABLE_NAME='profiles' then
   if OLD.time_zone is not distinct from NEW.time_zone then return NEW; end if;
  else
   if OLD.payload is not distinct from NEW.payload then return NEW; end if;
  end if;
 end if;
 if TG_OP='DELETE' then u:=OLD.user_id; else u:=NEW.user_id; end if;
 -- Do not resurrect generation state while auth-user deletion cascades.
 if exists(select 1 from auth.users where id=u) then
  perform pg_advisory_xact_lock(hashtextextended(u::text||':daily-inputs',0));
  insert into public.feature_input_generations(user_id,generation) values(u,1)
   on conflict(user_id) do update set generation=public.feature_input_generations.generation+1,changed_at=now();
 end if;
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;
revoke all on function public.invalidate_feature_inputs() from public,anon,authenticated;
create trigger metric_feature_dirty before insert or update or delete on public.metric_samples for each row execute function public.invalidate_feature_inputs();
create trigger event_feature_dirty before insert or update or delete on public.subjective_events for each row execute function public.invalidate_feature_inputs();
create trigger profile_feature_dirty before insert or update or delete on public.profiles for each row execute function public.invalidate_feature_inputs();
drop policy owner_read on public.daily_features;
create policy owner_read on public.daily_features for select to authenticated using (
 (select auth.uid())=user_id and input_generation=coalesce((select g.generation from public.feature_input_generations g where g.user_id=daily_features.user_id),0)
 and time_zone=(select p.time_zone from public.profiles p where p.user_id=daily_features.user_id)
);
drop policy owner_read on public.relationship_results;
create policy owner_read on public.relationship_results for select to authenticated using (
 (select auth.uid())=user_id and input_generation=coalesce((select g.generation from public.feature_input_generations g where g.user_id=relationship_results.user_id),0)
);
create function public.read_feature_generation(p_owner uuid) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('generation',coalesce((select generation from public.feature_input_generations where user_id=p_owner),0)::text,'timeZone',p.time_zone)
 from public.profiles p where p.user_id=p_owner;
$$;
create function public.commit_daily_features(p_owner uuid,p_generation text,p_rows jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare current_generation bigint; zone text; r jsonb; n integer:=0;
begin
 if p_generation is null or p_generation !~ '^[0-9]+$' then raise exception 'Invalid generation'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>60 then raise exception 'Invalid daily rows'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':daily-inputs',0));
 select coalesce((select generation from public.feature_input_generations where user_id=p_owner),0),time_zone into current_generation,zone from public.profiles where user_id=p_owner;
 if not found or current_generation<>p_generation::bigint then raise exception 'Inputs changed'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if r->>'userId' is distinct from p_owner::text or r->>'timeZone' is distinct from zone or r->>'builderVersion' is null or r->>'builderVersion' not in ('daily-v1:personal','daily-v1:demo') or r->>'contractVersion' is distinct from '1' or r->>'date' is null or jsonb_typeof(r->'features') is distinct from 'object' then raise exception 'Invalid daily metadata'; end if;
  insert into public.daily_features(user_id,date,time_zone,builder_version,payload,input_generation)
   values(p_owner,(r->>'date')::date,zone,r->>'builderVersion',r,current_generation)
   on conflict(user_id,date,time_zone,builder_version) do update set payload=excluded.payload,input_generation=excluded.input_generation;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.read_feature_generation(uuid),public.commit_daily_features(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.read_feature_generation(uuid),public.commit_daily_features(uuid,text,jsonb) to service_role;
commit;
