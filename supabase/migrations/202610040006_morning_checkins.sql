-- Stage 5 morning check-in interview state: only the user's own skips and end marker per local date.
-- Answers are never stored here; they are accepted subjective_events. Apply after migrations 001–005.
begin;
create table public.morning_checkins (
 user_id uuid not null references auth.users(id) on delete cascade,
 local_date date not null,
 skipped text[] not null default '{}',
 ended_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key (user_id, local_date),
 constraint morning_checkins_skipped_dimensions check (skipped <@ array['energy','soreness','mood','illness']::text[])
);
alter table public.morning_checkins enable row level security;
revoke all on public.morning_checkins from public, anon;
grant select, insert, update, delete on public.morning_checkins to authenticated;
grant all on public.morning_checkins to service_role;
create policy owner_select on public.morning_checkins for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.morning_checkins for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_delete on public.morning_checkins for delete to authenticated using ((select auth.uid()) = user_id);
create policy owner_update on public.morning_checkins for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
