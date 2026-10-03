-- Stage 1. Apply once to the hosted project, in Supabase SQL Editor.
-- Fail on an existing incompatible schema; never silently replace user tables.
begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Demo participant' check (length(display_name) between 1 and 100),
 time_zone text not null default 'UTC' check (length(time_zone) between 1 and 100),
 created_at timestamptz not null default now()
);
create table public.conversations (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 200),
 mode text not null check (mode in ('capture','morning_checkin','post_workout','investigate','experiment','doctor_prep')),
 started_at timestamptz not null, ended_at timestamptz,
 primary key (user_id,id), check (ended_at is null or ended_at >= started_at)
);
create table public.conversation_turns (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 200), conversation_id text not null,
 role text not null check (role in ('user','assistant')),
 transcript text not null check (length(transcript) between 1 and 20000), occurred_at timestamptz not null,
 primary key (user_id,id),
 foreign key (user_id,conversation_id) references public.conversations(user_id,id) on delete cascade
);
create table public.metric_samples (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 200),
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 observed_at timestamptz not null,
 metric text generated always as (payload->>'metric') stored not null,
 source_type text generated always as (payload#>>'{source,type}') stored not null,
 external_id text generated always as (payload#>>'{source,externalId}') stored not null,
 primary key (user_id,id),
 check ((payload->>'id') is not distinct from id),
 check ((payload->>'endedAt')::timestamptz is not distinct from observed_at),
 check (metric in ('hrv','resting_hr','sleep_duration','sleep_start','sleep_end','steps','active_energy','workout_duration','workout_avg_hr')),
 check (source_type in ('mock','apple_health')),
 check (length(external_id) between 1 and 200),
 check ((payload->>'unit') is not distinct from case metric when 'hrv' then 'ms' when 'resting_hr' then 'bpm' when 'workout_avg_hr' then 'bpm' when 'steps' then 'count' when 'active_energy' then 'kcal' when 'sleep_start' then 'iso8601' when 'sleep_end' then 'iso8601' else 'min' end)
);
create table public.subjective_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null check (length(id) between 1 and 200), conversation_turn_id text not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 observed_at timestamptz not null,
 event_type text generated always as (payload->>'type') stored not null,
 primary key (user_id,id),
 foreign key (user_id,conversation_turn_id) references public.conversation_turns(user_id,id) on delete cascade,
 check ((payload->>'id') is not distinct from id),
 check ((payload->>'conversationTurnId') is not distinct from conversation_turn_id),
 check ((payload->>'occurredAt')::timestamptz is not distinct from observed_at),
 check (event_type in ('energy','stress','mood','soreness','alcohol','caffeine','late_meal','illness','pain','workout_rpe'))
);
create table public.daily_features (
 user_id uuid not null references auth.users(id) on delete cascade,
 date date not null, time_zone text not null, builder_version text not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 primary key (user_id,date,time_zone,builder_version),
 check ((payload->>'userId') is not distinct from user_id::text),
 check ((payload->>'date') is not distinct from date::text),
 check ((payload->>'timeZone') is not distinct from time_zone),
 check ((payload->>'builderVersion') is not distinct from builder_version),
 check ((payload->>'contractVersion') is not distinct from '1')
);
create table public.relationship_results (
 user_id uuid not null references auth.users(id) on delete cascade,
 relationship_id text not null, period_from date not null, period_to date not null, analysis_version text not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 primary key (user_id,relationship_id,period_from,period_to,analysis_version),
 check (period_from <= period_to),
 check (relationship_id in ('sleep_duration__energy','alcohol__hrv','stress__sleep_duration','workout_rpe__energy')),
 check ((payload->>'userId') is not distinct from user_id::text),
 check ((payload->>'relationshipId') is not distinct from relationship_id),
 check ((payload#>>'{period,from}') is not distinct from period_from::text),
 check ((payload#>>'{period,to}') is not distinct from period_to::text),
 check ((payload->>'analysisVersion') is not distinct from analysis_version)
);
create index conversation_turns_session on public.conversation_turns(user_id,conversation_id,occurred_at);
create index metric_samples_time on public.metric_samples(user_id,observed_at desc);
create index subjective_events_time on public.subjective_events(user_id,observed_at desc);
create index metric_samples_kind on public.metric_samples(user_id,metric);
create unique index metric_samples_source_identity on public.metric_samples(user_id,source_type,external_id,metric);
create index subjective_events_turn on public.subjective_events(user_id,conversation_turn_id);
-- Scope every operation to the authenticated owner. Anonymous Auth users have
-- the authenticated role; unauthenticated API requests have the anon role.
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_turns enable row level security;
alter table public.metric_samples enable row level security;
alter table public.subjective_events enable row level security;
alter table public.daily_features enable row level security;
alter table public.relationship_results enable row level security;
do $$
declare table_name text;
begin
 foreach table_name in array array['profiles','conversations','conversation_turns','metric_samples','subjective_events','daily_features','relationship_results'] loop
  execute format('revoke all on public.%I from public, anon, authenticated', table_name);
  execute format('grant select on public.%I to authenticated', table_name);
  execute format('grant all on public.%I to service_role', table_name);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
 end loop;
 foreach table_name in array array['profiles','conversations','conversation_turns','metric_samples','subjective_events'] loop
  execute format('grant insert, update, delete on public.%I to authenticated', table_name);
  execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
  execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
  execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
 end loop;
end $$;
-- Derived writes are reserved for future deterministic backend pipelines.
-- Never give the browser or a model a service-role key.
commit;
