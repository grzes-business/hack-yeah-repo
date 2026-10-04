-- Stage 9: one durable active sensing loop per account. Apply once after 009.
begin;
create table public.evidence_question_loops (
 user_id uuid primary key references auth.users(id) on delete cascade,
 conversation_id text not null,
 revision integer not null check(revision>0),
 payload jsonb not null,
 foreign key(user_id,conversation_id) references public.conversations(user_id,id) on delete cascade
);
alter table public.evidence_question_loops enable row level security;
revoke all on public.evidence_question_loops from public,anon,authenticated;
grant select on public.evidence_question_loops to authenticated;
grant all on public.evidence_question_loops to service_role;
create policy owned_question_read on public.evidence_question_loops for select to authenticated using(user_id=auth.uid());
create function public.commit_question_loop(p_owner uuid,p_revision integer,p_generation text,p_zone text,p_state jsonb,p_capture jsonb default null)
returns integer language plpgsql security definer set search_path='' as $$
declare actual integer; conversation text; e jsonb; source text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':daily-inputs',0));
 if not exists(select 1 from public.profiles where user_id=p_owner and time_zone=p_zone)
 or coalesce((select generation::text from public.feature_input_generations where user_id=p_owner),'0')<>p_generation then raise exception 'Question inputs changed'; end if;
 select revision into actual from public.evidence_question_loops where user_id=p_owner for update;
 if coalesce(actual,0)<>p_revision then raise exception 'Question revision changed'; end if;
 if p_state->>'policy'<>'questions-v1' or p_state->'current'->'bundle'->'dailyFeatures'->>'userId'<>p_owner::text then raise exception 'Question owner/policy mismatch'; end if;
 conversation:='question:'||(p_state->>'id');
 insert into public.conversations(user_id,id,mode,started_at,ended_at) values(p_owner,conversation,'investigate',now(),null) on conflict(user_id,id) do nothing;
 if p_capture is not null then
  source:=p_capture->>'turnId';
  if source is null or p_capture->>'text' is null then raise exception 'Answer provenance required'; end if;
  insert into public.conversation_turns(user_id,id,conversation_id,role,transcript,occurred_at)
  values(p_owner,source||':question',conversation,'assistant',p_capture->>'question',(p_capture->>'at')::timestamptz),
        (p_owner,source,conversation,'user',p_capture->>'text',(p_capture->>'at')::timestamptz)
  on conflict(user_id,id) do nothing;
  if p_capture->'result'->>'status'='captured' then
   for e in select value from jsonb_array_elements(p_capture->'result'->'events') loop
    if e->>'conversationTurnId'<>source or e->>'timeZone'<>p_zone or (e->>'capturedAt')::timestamptz<>(p_capture->>'at')::timestamptz then raise exception 'Answer event provenance mismatch'; end if;
    if p_state->'input'->>'scope'='demo' then
     if e->>'id' not like 'demo:question:%' then raise exception 'Synthetic answer identity required'; end if;
    elsif e->>'id' not like 'capture:v1:%' then raise exception 'Canonical answer identity required'; end if;
    insert into public.subjective_events(user_id,id,conversation_turn_id,payload,observed_at)
    values(p_owner,e->>'id',source,e,(e->>'occurredAt')::timestamptz)
    on conflict(user_id,id) do nothing;
   end loop;
  end if;
 end if;
 insert into public.evidence_question_loops(user_id,conversation_id,revision,payload) values(p_owner,conversation,p_revision+1,p_state)
 on conflict(user_id) do update set conversation_id=excluded.conversation_id,revision=excluded.revision,payload=excluded.payload;
 return p_revision+1;
end $$;
revoke all on function public.commit_question_loop(uuid,integer,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.commit_question_loop(uuid,integer,text,text,jsonb,jsonb) to service_role;
commit;
