# Stage 6 — Daily observations, aggregation and freshness

Implemented 2026-10-04; behavioral acceptance pending. Import pure projections from `lib/features/builder.ts`; request authenticated reads/rebuilds through `/api/features`. No model call, baseline, anomaly or relationship calculation is part of this stage.

## Contracts and entry points

- `buildDailyFeatures(date, input)` and `rebuildDailyFeatures(from, to, input)` validate canonical inputs and produce all 19 feature states under the unchanged Stage 0 schema. Input arrays are already scoped; callers must supply owned records and a consistent generation. Source labels do not change aggregation math.
- `GET /api/features?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=personal|demo` returns current rows plus `missingDates`. Missing dates mean unbuilt/stale, not a zero observation. `POST /api/features` takes the same strict fields as JSON and rebuilds the inclusive range. At most 60 days per request; a single day uses equal bounds. Caller-provided owner, zone, provenance and feature payloads are rejected.
- `lib/features/server.ts` verifies orchestration boundaries: the route authenticates the Supabase JWT before passing its verified owner; raw reads use the owner's normal client and complete paginated repository queries. Output validates before a trusted server commit. HTTP responses are no-store; failures return generic recovery messages without observations or secrets in diagnostics.
- The Today daily-observations inspector exposes range/scope, rebuild, values, unknown reasons and raw source IDs. It is a development/product inspection surface, not the planned mobile redesign or an evidence investigation.

Builder versions are `daily-v1:personal` and `daily-v1:demo`. Personal scope excludes mock metrics and `demo:` events; demo scope includes only mock metrics and `demo:` events. Scope is explicit in API/UI and version identity, so synthetic records never complete a personal row. Adapter-label parity means identical selected canonical values/intervals produce identical feature values; it does not override scope filtering.

## Version 1 aggregation manifest

All metrics use local interval-end date; sleep therefore uses wake date for duration and both boundaries. Subjective events use occurrence date in the row's profile zone, not capture date. No lag is applied in the builder; analytical consumers shift factor dates exactly once using the registry.

| Feature | Eligible input / units | Daily summary | Coverage and conflict rule |
| --- | --- | --- | --- |
| `hrv` | SDNN samples / ms | Median of unique interval/value observations | At least one sample; differing values for an identical interval are ambiguous. |
| `resting_hr` | Resting-HR samples / bpm | Same median rule | No conversion of ordinary HR to resting HR. |
| `sleep_duration` | Recorded sleep duration / min | Sum distinct disjoint sessions/segments | Keep full samples, never clip or infer duration from boundaries. |
| `sleep_start` | Full-session start boundary / UTC ISO | Earliest recorded start among disjoint intervals assigned to wake day | Do not invent a missing boundary. |
| `sleep_end` | Full-session end boundary / UTC ISO | Latest recorded end among disjoint intervals assigned to wake day | Multiple sessions span gaps; the boundary span is not sleep duration. |
| `steps` | Interval count | Sum distinct disjoint intervals | Recorded total only, not proof of full-day coverage. Explicit zero is known. |
| `active_energy` | Interval active energy / kcal | Same sum rule | No calorie inference from steps/workouts. |
| `workout_duration` | Recorded duration / min | Same sum rule | Missing workout does not establish rest or zero. |
| `workout_avg_hr` | Recorded workout average / bpm | One average directly; multiple averages weighted by elapsed interval minutes | Multiple samples require positive interval durations and disjoint intervals; otherwise insufficient/ambiguous. No inferred training load. |
| `energy` | Accepted 0–10 rating | Latest occurrence-time report | Differing values tied at that instant are ambiguous, rather than breaking ties by ID. |
| `stress` | Accepted 0–10 rating | Same latest rule | No adjective-to-rating conversion. |
| `mood` | Accepted 0–10 rating | Same latest rule | Earlier daily reports remain raw history. |
| `soreness` | Accepted 0–10 rating | Same latest rule | No rating inferred from a workout. |
| `workout_rpe` | Accepted 0–10 rating | Same latest rule | A representative latest rating, not duration-weighted effort or load. |
| `pain` | Accepted structured pain value | Same latest rule | Keep explicit unknown location/intensity; conflicting tied structured values are ambiguous. |
| `alcohol` | Accepted consumed flag | Known exposure when all reports agree | Any mix of intake and reported absence is ambiguous; quantity is not required for exposure. |
| `late_meal` | Accepted boolean | Known when all reports agree | Conflicting reports are ambiguous; no automatic clock threshold. |
| `illness` | Accepted boolean | Same agreement rule | Not a diagnosis and no absent report implies false. |
| `caffeine` | Accepted dose / mg | Sum distinct intake reports with known mg; explicit absence is 0 | Any consumed report with null mg makes daily dose not available. Intake plus reported absence is ambiguous. |

### Deduplication, gaps and provenance

Duplicate IDs with identical canonical records coalesce; conflicting payloads under an ID fail the build. Exact metric intervals with equal values coalesce across source labels and contribute once, retaining all supporting raw IDs. Equal instants normalize through epoch comparison. For other overlapping intervals there is no source priority: additive totals, sleep boundaries and workout averages become ambiguous, including overlap with another end-day in the loaded input context. Conflicting interval descriptions of the same explicit session also become ambiguous. HRV/resting-HR summaries may overlap at different intervals; identical-interval disagreements remain ambiguous.

Non-summary metric intervals longer than 26 elapsed hours are insufficient coverage in this initial daily policy. This is a processing eligibility bound, not a health claim. It admits normal 23/25-hour DST days and prevents assigning a multi-day total to one day. Query envelopes extend two UTC days on both sides, return entire overlapping samples, and exact local-day filtering is performed in code. This includes neighboring intervals needed for overlap checks without clipping long overnight samples. Source-specific overlap resolution remains Stage 13 work.

Caffeine duplicates at the same occurrence instant, value and conversation turn count once; separate source turns are independent reports. Genuine duplicate reports from separate conversations cannot be distinguished automatically in version 1. Conflicting self-reports must be corrected through the canonical capture flow; the builder never edits raw records to repair them.

Unknowns: no eligible input → `not_observed`; unknown consumed caffeine dose → `not_available`; conflicts → `ambiguous`; unsupported interval duration/weight coverage → `insufficient_coverage`. A known recorded total does not assert complete wear time or a complete intake diary. Partial non-overlapping data remains a recorded total; no missing intervals are filled. Unknown states carry no values. Known states retain sorted unique IDs of exactly the supporting raw kind; latest-report projections cite selected reports, aggregate projections cite contributors including equivalent duplicates.

Calendar assignment uses the provided IANA zone and absolute stored instants. Travel/time-zone changes regroup on explicit rebuild; historical event zones remain raw provenance. `builtAt` records orchestration time and can change on replay; analytical values/provenance are deterministic for identical inputs, zone and builder version.

## Trusted writer and consistent generations

Configure `SUPABASE_SERVICE_ROLE_KEY` in server secrets only; `.env.example` contains an empty placeholder. A legacy service-role JWT or Supabase secret API key providing the server service role belongs here. Never prefix it with `NEXT_PUBLIC_`, bundle it, log it, or give it to a model. The writer is isolated behind `import "server-only"`. GET reads do not require this key.

Migration `202610040007_daily_feature_generations.sql` was applied to hosted Supabase on 2026-10-04. Do not reapply it or earlier creation migrations; SQL Editor does not reconcile the CLI ledger. It adds an owner-readable generation counter and `input_generation` metadata to daily/relationship rows. Existing legacy rows with null generation are stale. Direct browser derived writes remain denied; `read_feature_generation` and `commit_daily_features` execute only for the service role, unlike the owner-callable capture RPCs.

A rebuild reads generation and profile zone, performs full paginated raw reads, then rereads generation/zone. Any change retries the read. The commit takes the same per-owner advisory transaction lock as raw mutation triggers, rechecks generation/zone, and atomically upserts every requested daily row. An input change during commit is serialized; a changed generation rejects stale writes. There are at most three attempts; continuous mutation yields a truthful 409 retry response. Readers also check generation/zone around row loading and reject mixed reads. Responses describe freshness at read time, not a promise that later mutations cannot occur.

The server-only generation token is a decimal string to preserve bigint precision. Public metadata currently uses the standard Supabase numeric bigint representation; normal demo generation counts are well within JavaScript safe integers. Future very large counters require string-safe public freshness reads.

## Invalidation and later consumers

Triggers on metric/event insert, meaningful update and delete increment the owner's generation in the same transaction, including capture replacement and conversation/fixture cascades. Identical payload upserts do not dirty derived data. Profile time-zone insert/change/delete also invalidates; changing only display name does not. No triggers alter raw observations.

Version 1 deliberately invalidates **all dates, scopes, zones, versions and relationship results for that owner** after any raw change. This is conservative and covers prior-day lags and historical baselines without guessing a narrow affected window. RLS hides outdated daily/relationship rows as current. Old rows are retained physically for inspection by a trusted operator; API reads report affected requested dates as missing until explicitly rebuilt. There is no background job or automatic full-history rebuild.

Future Stage 7 service-role readers bypass RLS and **must explicitly match generation** for daily/results, persist the matching generation and reject stale commits; they must not interpret a stale row as current. In-memory/cached bundles must be keyed by generation, zone and builder/analysis versions and invalidated or checked before serving. No bundle cache or analytical writer exists in Stage 6. A partial range rebuild makes only that range current; rebuild older ranges separately. Analytical consumers need complete range reads, not the inspector/repository's bounded browsing list.

## Verification status and manual acceptance

TypeScript, lint and production build passed during implementation; hosted SQL Editor confirmed migration success. Behavioral tests, live rebuild calls and browser acceptance were not run in this turn. The new secret's presence was checked without disclosure; presence is not proof the credential has the required role. All Stage 6 behavioral ACs remain pending their documented checks.

For a manual first run: on Today choose Synthetic demo only, load sample history and rebuild its date range. Inspect known values and unknown caffeine doses, then remove fixtures: previous daily rows should stop appearing as current. Rebuild again to see unknown rows. For personal scope, capture an explicit rating, rebuild its occurrence day, correct it, confirm the old daily row becomes unavailable and rebuild to see the replacement. Repeat reload/range boundaries and a separate user's session. The Stage 6 guide retains the full DST/overlap/concurrency/provenance acceptance plan.

### Voice acceptance incident — 2026-10-04

The owner reported that two caffeine intakes yielded only the later amount, and alcohol intake plus absence yielded false. Canonical records and voice receipts showed the later utterances were applied as corrections, leaving only one active event of each type. The caffeine clock was retained precisely (11:00 Warsaw on the stated past day). This is a capture/voice routing failure, not evidence that the builder chooses the last caffeine report. See [VOICE](VOICE.md) for the fix and repeat-check instructions. These two end-to-end ACs remain pending recheck; replaced records are not automatically resurrected. Other Stage 6 behavioral criteria retain their documented pending status.
