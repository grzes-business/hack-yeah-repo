-- JavaScript ISO timestamps retain milliseconds; Postgres now() retains microseconds.
-- Normalize the frozen ledger timestamp without changing ownership or lease checks.
-- Existing failed captures can retry with their original claim.
begin;

create or replace function public.finish_turn_extraction(p_root text, p_token uuid, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); j public.turn_extractions; e jsonb; status text; old jsonb;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_token is null then raise exception 'Lease token required'; end if;
 select * into j from public.turn_extractions where user_id=u and root_turn_id=p_root and extractor_version='capture-v1' for update;
 if not found or j.lease_token is distinct from p_token or j.lease_until is null or j.lease_until <= now() then raise exception 'Extraction lease expired'; end if;
 status := p_result->>'status';
 if status is null or status not in ('captured','nothing_trackable','needs_clarification') then raise exception 'Invalid extraction status'; end if;
 if status='captured' then
  if jsonb_typeof(p_result->'events') is distinct from 'array' or jsonb_array_length(p_result->'events') not between 1 and 20 then raise exception 'Invalid event list'; end if;
  if (select count(distinct item->>'id') from jsonb_array_elements(p_result->'events') item) <> jsonb_array_length(p_result->'events') then raise exception 'Duplicate event IDs'; end if;
  for e in select value from jsonb_array_elements(p_result->'events') loop
   if (e->>'conversationTurnId') is distinct from j.source_turn_id or (e->>'timeZone') is distinct from j.time_zone
    or (e->>'capturedAt')::timestamptz is distinct from date_trunc('milliseconds', j.captured_at)
    or (e->>'occurredAt')::timestamptz > j.captured_at
    or (e->>'id') not like 'capture:v1:%' then raise exception 'Event provenance mismatch'; end if;
   if exists(select 1 from public.subjective_events where user_id=u and id=e->>'id' and conversation_turn_id<>j.source_turn_id) then raise exception 'Event identity collision'; end if;
  end loop;
  if j.accepted_result is not null then
   for old in select value from jsonb_array_elements(j.accepted_result->'events') loop
    delete from public.subjective_events where user_id=u and id=old->>'id' and conversation_turn_id=old->>'conversationTurnId';
   end loop;
  end if;
  for e in select value from jsonb_array_elements(p_result->'events') loop
   insert into public.subjective_events(user_id,id,conversation_turn_id,payload,observed_at)
   values(u,e->>'id',j.source_turn_id,e,(e->>'occurredAt')::timestamptz)
   on conflict(user_id,id) do update set payload=excluded.payload, observed_at=excluded.observed_at;
  end loop;
 end if;
 update public.turn_extractions set
  history=history || jsonb_build_array(jsonb_build_object('revision',revision+1,'sourceTurnId',source_turn_id,'result',p_result,'capturedAt',captured_at)),
  result=p_result, accepted_result=case when status='captured' then p_result else accepted_result end,
  revision=revision+1, lease_token=null, lease_until=null
 where user_id=u and root_turn_id=p_root and extractor_version='capture-v1' returning * into j;
 return to_jsonb(j);
end $$;

commit;
