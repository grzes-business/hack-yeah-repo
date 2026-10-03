-- Support indexed overlap reads without clipping complete sample intervals.
begin;
alter table public.metric_samples add column started_at timestamptz;
update public.metric_samples set started_at = (payload->>'startedAt')::timestamptz where started_at is null;
alter table public.metric_samples alter column started_at set not null;
alter table public.metric_samples add constraint metric_interval_payload
 check ((payload->>'startedAt')::timestamptz is not distinct from started_at);
alter table public.metric_samples add constraint metric_interval_order check (started_at <= observed_at);
create index metric_samples_start on public.metric_samples(user_id,started_at);
commit;
