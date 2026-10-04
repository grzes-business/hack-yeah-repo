# Stage 2 — Mock history and canonical ingestion

Stage 2 is implemented. `MockHealthDataSource` provides wearable-like records through the Stage 0 interface. Subjective demo observations have a separate fixture path; they do not represent recorded speech or model extraction. No daily features, statistical engine, or evidence labels are calculated in this stage.

## Using the demo

Start a private demo session, then on Today choose **Load sample history**. The default is 56 completed local dates ending yesterday in the profile's IANA time zone. An end-date input allows a reproducible historical window. The UI identifies the data as fictional. Timeline distinguishes **Demo sample** from **Synthetic conversation fixture** and ordinary conversation observations.

Use **Remove sample history** to remove this user's generated records for the current fixture version, seed, and time zone. Other raw observations and other users' records are preserved. Load again to restore identical history. Changing the end date extends/overlaps history within the same namespace; loading a shorter window does not remove prior dates. To replace the window exactly, remove first, then load. Changing the profile time zone uses another namespace; select the original zone to remove its history.

## Reproducibility and identity

`DemoOptionsSchema` takes `endDate`, `timeZone`, optional `days` (1–60; default 56), and optional integer `seed` (default 2026). Small windows support boundary tests; the product loads 56 days. The generator has no implicit clock: callers supply the anchor. Equal options produce equal IDs, values, timestamps, and transcript fixtures.

Identifiers use `demo:v1:{seed}:{encodedZone}:{date}:{slot}`. The source external ID equals the stable sample ID. Keyed randomness depends on seed, calendar date, and variable, so overlapping windows preserve identical observations. The authenticated repository attaches ownership; no fixture supplies a user ID. Version the namespace whenever a recipe changes accepted values or identities, rather than silently changing already-seeded history.

Reference fixture: `endDate=2026-10-02`, `days=56`, `seed=2026`, `timeZone=Europe/Warsaw` covers **2026-08-08 through 2026-10-02**. It contains **459 metric samples, 529 subjective events, 56 conversations, and 56 user turns**. Counts are persistence receipts, not analytical evidence or sample sizes for relationships.

## Ground truth recipe

The recipe deliberately contains variation, competing factors, and omissions. These are synthetic generating mechanisms for later analytics validation, not medical claims or evidence inferred from a person.

| Predefined relationship | Planted mechanism |
| --- | --- |
| Sleep → energy, lag 0 | Wake-date sleep duration contributes positively to same-day energy, with effort/illness and noise also affecting energy. |
| Alcohol → HRV, lag 1 | Prior-day synthetic alcohol exposure subtracts 15 ms from next-day latent HRV. Illness and noise also affect it. |
| Stress → sleep, lag 1 | Prior-day stress subtracts 18 minutes per rating point from following-night duration, with alcohol/noise also contributing. |
| Workout RPE → energy, lag 1 | Prior-day synthetic effort subtracts 0.35 rating points per effort point from energy; rest days have no RPE report. |

The exact formulas and channels live in [`scenario.ts`](../lib/demo/scenario.ts), not in model prompts. Sleep has a wake clock of 07:30 local and an interval whose elapsed minutes match its value, including DST changes. Start/end/duration samples share a sleep session ID. Workout metrics share a session ID with the subjective RPE fixture. Steps and energy cover the local midnight-to-20:00 interval; HRV/resting HR are morning instants.

Each day has a synthetic retrospective conversation/turn at 22:00 local, with an explicit synthetic transcript marker. Events preserve their separate occurrence times and use `extractionConfidence: null`. Transcripts serialize exactly the generated observations; this does not implement extraction. Observed illness is a boolean, never a diagnosis.

## Missingness

Absolute calendar-day ordinal schedules omit HRV every 13th day, the whole sleep session every 17th day, energy every 9th day, stress every 10th day, and alcohol reporting every 15th day. Rest days omit workout metrics and RPE. These are missing records, not zero-valued activity or negative reports. Caffeine is consumed with an unknown dose every 11th day (`amountMg: null`); explicit negative alcohol, illness, and pain reports remain distinct.

Scenario ground truth is available only to fixture code/tests. Never fill omitted observations from latent scenario values when building features or investigating outcomes. The first retained outcome day may lack its previous-day factor record even though the generating recipe used that latent factor; later pairing must exclude missing context normally.

## Ingestion, reads, and failure behavior

- [`ingestHealthData()`](../lib/health/ingestion.ts) validates the requested range and the **entire** adapter response before writing: registered metrics, units, intervals, requested-key membership, half-open overlap, unique IDs, and unique source identity. Empty input produces a zero receipt without a write.
- The repository validates again, verifies the signed-in user, and upserts in batches of 200 using `(user_id, id)`. Repeated input updates the same records. Source identity uniqueness rejects one external observation presented under another canonical ID.
- [`seedDemoHistory()`](../lib/demo/seed.ts) validates subjective fixtures before any writes; objective ingestion then precedes conversation → turn → event persistence. It checks every persistence count before returning success.
- A load is **not** one transaction across all tables. Failure can leave completed batches. `PartialWriteError` records the confirmed count in its current table; the UI does not claim completion. Retrying identical options safely completes/replays the records. Concurrent load/removal is unsupported; the UI serializes operations, and callers must do the same.
- Complete range reads page in groups of 250. Metric queries retain full overlapping intervals; instantaneous samples include `from` and exclude `to`, and a nonzero interval ending at `from` is excluded. Subjective queries use occurrence time in `[from,to)`. Owner and payload metadata are validated on every row.
- Paginated reads assume no concurrent history mutation. Duplicate IDs caused by shifting pages fail validation; consistent analytical snapshots remain a Stage 6 responsibility. Do not use the Timeline's capped display read as full analytical history.
- Removal filters the authenticated owner plus escaped version/seed/zone namespace. Metric cleanup also requires the mock source. Conversation removal cascades its synthetic turns/events. The method checks that selected fixtures are gone before reporting success. It does not clear derived records; Stage 6 must add invalidation before derived pipelines and raw reset are used together.

## Files and verification

| Boundary | Implementation |
| --- | --- |
| Scenario/clock/IDs | `lib/demo/scenario.ts` |
| Objective source | `lib/health/mock-data-source.ts` |
| Canonical ingestion | `lib/health/ingestion.ts` |
| Subjective fixture path | `lib/demo/subjective-fixtures.ts` |
| Seed orchestration | `lib/demo/seed.ts` |
| Owned batches/range reads/removal | `lib/db/ingestion.ts` |
| Indexed full intervals | `supabase/migrations/202610030002_metric_intervals.sql` |
| Product controls | `app/components/demo-history.tsx` |

The interval migration is applied to the current hosted project. On a fresh project, apply migrations in filename order; it backfills only the new `started_at` column and checks agreement with canonical payloads. Do not rerun either creation/alteration migration on an already-updated project.

`pnpm test` covers reproducibility, overlapping windows, registered inputs, gaps versus explicit absence, unknown doses, DST, source range boundaries, planted lag direction, whole-response validation, verified ownership, partial writes, seed replay, and provenance. `pnpm verify:hosted` adds opt-in live Stage 1/2 acceptance checks. It uses only the public configuration, creates two anonymous Auth users, and deletes their test records on completion/failure; their disposable Auth accounts remain because no privileged cleanup key is used. It never deletes another user's records. Browser checks cover sign-in/profile restore, sample loading, and Timeline labeling.

## Stage 6 derived rows

Demo daily building is an explicit `demo` scope (`daily-v1:demo`), separate from personal observations. Fixture upsert/removal and cascaded event removal advance input generation through database triggers; previous derived rows become stale and disappear from current reads. Rebuild the chosen date range after changing samples; there is no automatic background rebuild. Removed observations produce unknown states, not zeros. See [DAILY-FEATURES](DAILY-FEATURES.md).

## Sample voice reports in personal history (owner decision, 2026-10-04)

For demos with real Apple Health data, the owner can opt in to **sample reports**: 30 days of fictional subjective reports (energy, mood, soreness, stress, alcohol, caffeine, late meal, illness, pain, workout RPE) ending yesterday, saved in personal history next to real wearable data. They reuse the fixed scenario generator under the `sample:v1:<seed>:<zone>:` namespace (`lib/demo/sample-reports.ts`). Rules:

- Values come from the scenario, never from the owner's real measurements, so no relationship with real data is manufactured.
- Every surface labels them: transcripts start “[Sample report; fictional…]”, History shows “Sample report (fictional)” with its own filter, Today shows “Sample report · fictional”.
- Only the `demo:` prefix routes records to the synthetic scope; `sample:` records are personal-scope inputs and therefore appear in personal evidence. One tap (“Remove sample reports”) deletes the conversations, cascading to turns and events; real data is untouched.
