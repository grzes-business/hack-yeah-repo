-- Stage 7 private analytical writer. Apply once after migration 008.
begin;
alter table public.relationship_results add column time_zone text;
alter table public.relationship_results add column builder_version text;
drop policy owner_read on public.relationship_results;
create policy owner_read on public.relationship_results for select to authenticated using (
 (select auth.uid())=user_id
 and input_generation=coalesce((select generation from public.feature_input_generations g where g.user_id=relationship_results.user_id),0)
 and time_zone=(select time_zone from public.profiles p where p.user_id=relationship_results.user_id)
 and builder_version in ('daily-v1:personal','daily-v1:demo')
 and analysis_version='analytics-v1:'||builder_version
);
create function public.commit_relationship_results(p_owner uuid,p_generation text,p_zone text,p_builder text,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare current_generation bigint; zone text; r jsonb; n integer:=0; first_date date; last_date date; coverage integer;
begin
 if p_generation is null or p_generation !~ '^[0-9]+$' or p_builder is null or p_builder not in ('daily-v1:personal','daily-v1:demo') then raise exception 'Invalid analytical metadata'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<>4 then raise exception 'Four registered results required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':daily-inputs',0));
 select coalesce((select generation from public.feature_input_generations where user_id=p_owner),0),time_zone into current_generation,zone from public.profiles where user_id=p_owner;
 if not found or current_generation<>p_generation::bigint or zone is distinct from p_zone then raise exception 'Inputs changed'; end if;
 if (select count(distinct value->>'relationshipId') from jsonb_array_elements(p_rows))<>4 then raise exception 'Duplicate analytical result'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if r->>'userId' is distinct from p_owner::text or r->>'analysisVersion' is distinct from 'analytics-v1:'||p_builder
   or r->>'relationshipId' is null or r->>'relationshipId' not in ('sleep_duration__energy','alcohol__hrv','stress__sleep_duration','workout_rpe__energy')
   or r->>'status' is null or r->>'status' not in ('evaluated','insufficient_data') then raise exception 'Invalid result metadata'; end if;
  first_date:=(r->'period'->>'from')::date; last_date:=(r->'period'->>'to')::date;
  if first_date is null or last_date is null or last_date-first_date<>41 then raise exception 'Invalid analysis period'; end if;
  select count(*) into coverage from public.daily_features where user_id=p_owner and time_zone=zone and builder_version=p_builder and input_generation=current_generation and date between first_date-1 and last_date+1;
  if coverage<>44 then raise exception 'Current daily history required'; end if;
  insert into public.relationship_results(user_id,relationship_id,period_from,period_to,analysis_version,payload,input_generation,time_zone,builder_version)
   values(p_owner,r->>'relationshipId',first_date,last_date,r->>'analysisVersion',r,current_generation,zone,p_builder)
   on conflict(user_id,relationship_id,period_from,period_to,analysis_version) do update set payload=excluded.payload,input_generation=excluded.input_generation,time_zone=excluded.time_zone,builder_version=excluded.builder_version;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.commit_relationship_results(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_relationship_results(uuid,text,text,text,jsonb) to service_role;
commit;
