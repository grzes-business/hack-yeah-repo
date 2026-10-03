-- Stage 4: owned extraction bookkeeping and atomic observation replacement.
-- Apply once; existing observations are not modified by this migration.
begin;
create table public.turn_extractions (
 user_id uuid not null references auth.users(id) on delete cascade,
 root_turn_id text not null,
 extractor_version text not null check (extractor_version = 'capture-v1'),
 source_turn_id text not null,
 root_transcript text not null,
 anchor_at timestamptz not null,
 time_zone text not null,
 captured_at timestamptz not null default now(),
 revision integer not null default 0 check (revision >= 0),
 result jsonb,
 accepted_result jsonb,
 history jsonb not null default '[]'::jsonb check (jsonb_typeof(history) = 'array'),
 lease_token uuid, lease_until timestamptz,
 primary key (user_id,root_turn_id,extractor_version),
 foreign key (user_id,root_turn_id) references public.conversation_turns(user_id,id) on delete cascade,
 foreign key (user_id,source_turn_id) references public.conversation_turns(user_id,id) on delete cascade
);
alter table public.turn_extractions enable row level security;
revoke all on public.turn_extractions from public, anon, authenticated;
grant select on public.turn_extractions to authenticated;
grant all on public.turn_extractions to service_role;
create policy owner_read on public.turn_extractions for select to authenticated using ((select auth.uid()) = user_id);

create function public.claim_turn_extraction(p_root text, p_token uuid, p_revision integer default null, p_followup_id uuid default null, p_followup text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 u uuid := auth.uid(); t public.conversation_turns; j public.turn_extractions;
 source_id text; zone text; source public.conversation_turns;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_token is null then raise exception 'Lease token required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || p_root, 0));
 select * into t from public.conversation_turns where user_id=u and id=p_root;
 if not found or t.role <> 'user' then raise exception 'Owned user turn required'; end if;
 if not exists(select 1 from public.conversations where user_id=u and id=t.conversation_id and mode='capture') then raise exception 'Capture conversation required'; end if;
 if (p_followup_id is null) <> (p_followup is null) then raise exception 'Invalid follow-up'; end if;
 if p_followup is not null and (length(trim(p_followup)) < 1 or length(p_followup) > 2000) then raise exception 'Invalid follow-up'; end if;
 select time_zone into zone from public.profiles where user_id=u;
 if zone is null then raise exception 'Profile required'; end if;
 insert into public.turn_extractions(user_id,root_turn_id,extractor_version,source_turn_id,root_transcript,anchor_at,time_zone)
 values(u,p_root,'capture-v1',p_root,t.transcript,t.occurred_at,zone) on conflict do nothing;
 select * into j from public.turn_extractions where user_id=u and root_turn_id=p_root and extractor_version='capture-v1' for update;
 if j.root_transcript <> t.transcript or j.anchor_at <> t.occurred_at then raise exception 'Original transcript changed; use a new turn'; end if;
 source_id := case when p_followup_id is null then j.source_turn_id else 'capture:' || p_followup_id::text end;
 if j.lease_token is not null and j.lease_until > now() then return jsonb_build_object('state','busy'); end if;
 if p_followup_id is not null and source_id=j.source_turn_id then
  select * into source from public.conversation_turns where user_id=u and id=source_id;
  if source.transcript is distinct from trim(p_followup) then raise exception 'Follow-up identity mismatch'; end if;
 end if;
 if j.result is not null and (p_followup_id is null or source_id=j.source_turn_id) and j.lease_token is null then
  return jsonb_build_object('state','cached','job',to_jsonb(j));
 end if;
 if p_followup_id is not null and source_id <> j.source_turn_id then
  if p_revision is null or p_revision <> j.revision then raise exception 'Capture changed; reload before correcting'; end if;
  if j.result is null then raise exception 'Finish initial extraction before clarifying'; end if;
  insert into public.conversation_turns(user_id,id,conversation_id,role,transcript,occurred_at)
  values(u,source_id,t.conversation_id,'user',trim(p_followup),now()) on conflict do nothing;
  select * into source from public.conversation_turns where user_id=u and id=source_id;
  if source.conversation_id <> t.conversation_id or source.role <> 'user' or source.transcript <> trim(p_followup) then raise exception 'Follow-up identity mismatch'; end if;
  update public.turn_extractions set source_turn_id=source_id, captured_at=now(), lease_token=p_token, lease_until=now()+interval '90 seconds'
  where user_id=u and root_turn_id=p_root and extractor_version='capture-v1' returning * into j;
 else
  update public.turn_extractions set lease_token=p_token, lease_until=now()+interval '90 seconds'
  where user_id=u and root_turn_id=p_root and extractor_version='capture-v1' returning * into j;
 end if;
 select * into source from public.conversation_turns where user_id=u and id=j.source_turn_id;
 return jsonb_build_object('state','ready','job',to_jsonb(j),'root',to_jsonb(t),'source',to_jsonb(source));
end $$;

create function public.finish_turn_extraction(p_root text, p_token uuid, p_result jsonb)
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
    or (e->>'capturedAt')::timestamptz is distinct from j.captured_at
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

create function public.release_turn_extraction(p_root text, p_token uuid)
returns void language sql security definer set search_path = '' as $$
 -- Keep an expired marker so an unfinished correction is retried rather than
 -- returned as a cache hit for the prior result.
 update public.turn_extractions set lease_until=now()
 where user_id=auth.uid() and root_turn_id=p_root and extractor_version='capture-v1' and lease_token=p_token;
$$;
revoke all on function public.claim_turn_extraction(text,uuid,integer,uuid,text), public.finish_turn_extraction(text,uuid,jsonb), public.release_turn_extraction(text,uuid) from public, anon;
grant execute on function public.claim_turn_extraction(text,uuid,integer,uuid,text), public.finish_turn_extraction(text,uuid,jsonb), public.release_turn_extraction(text,uuid) to authenticated;
commit;
