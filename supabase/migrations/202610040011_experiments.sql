-- Stage 14: owner-scoped personal experiment plans.
-- Plans are predeclared intent (template, periods, targets, policy version) plus a
-- lifecycle event log. Results are never stored: the server recomputes them from
-- current daily features on every read, so browsers cannot forge outcomes.
create table if not exists public.experiments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 200),
  scope text not null check (scope in ('personal','demo')),
  status text not null check (status in ('active','paused','completed','abandoned')),
  plan jsonb not null,
  events jsonb not null default '[]'::jsonb check (jsonb_typeof(events) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  check ((plan->>'id') is not distinct from id),
  check ((plan->>'scope') is not distinct from scope)
);

-- At most one open (active or paused) experiment per owner and data scope.
create unique index if not exists experiments_one_open_per_scope
  on public.experiments (user_id, scope) where status in ('active','paused');

alter table public.experiments enable row level security;

drop policy if exists "experiments owner read" on public.experiments;
create policy "experiments owner read" on public.experiments
  for select to authenticated using (user_id = (select auth.uid()));

-- No insert/update/delete policies: writes go through the authenticated
-- /api/experiments route using the server-only writer, which validates the plan
-- and lifecycle transitions in application code.
revoke insert, update, delete on public.experiments from anon, authenticated;
