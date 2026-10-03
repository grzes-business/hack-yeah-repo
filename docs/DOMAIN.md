# Stage 0 — Frozen domain contracts (version 1)

Stage 0 is implemented. Import reusable types, registries, and Zod schemas from `@/lib/domain`; import the source interface from `@/lib/health/data-source`. These modules depend on Zod and platform primitives only, with no Next.js, Supabase, voice-provider, or HealthKit dependency. Schema-inferred TypeScript types and runtime validation share one source of truth.

## Contract map

| Module | Public concepts |
| --- | --- |
| [Primitives](../lib/domain/primitives.ts) | IDs, UTC instants, local dates, IANA zones, periods, provenance, calendar helpers, contract version. |
| [Metrics](../lib/domain/metrics.ts) | `Metrics`, `MetricRegistry`, `MetricSampleSchema`, `MetricSample`. |
| [Events](../lib/domain/events.ts) | `Events`, `SubjectiveEventRegistry`, draft/accepted event schemas and extraction outcomes. |
| [Features](../lib/domain/features.ts) | `Features`, `FeatureRegistry`, explicit known/unknown states, `DailyFeaturesSchema`. |
| [Relationships](../lib/domain/relationships.ts) | Immutable allowed graph, relationship IDs/schema, outcome/method types, factor-date helper. |
| [Modes](../lib/domain/agent-modes.ts) | Mode vocabulary and initial morning dimensions. |
| [Evidence](../lib/domain/evidence.ts) | Evidence labels, method-specific effects, relationship results, anomalies, `EvidenceBundleSchema`. |
| [Source interface](../lib/health/data-source.ts) | `HealthDataSource`, request schema, response boundary validation. |

All objects are strict: unknown fields are rejected. Inputs are not coerced, missing health values are not defaulted to zero, and nonfinite numbers are rejected. Registry objects and entries are frozen. Parsed application records are ordinary data, not proof of authorization or statistical correctness.

## Metric Registry

The initial nine keys are frozen. Unit conversion is an adapter responsibility; downstream schemas accept canonical units only.

| Key | Canonical value/unit | Definition |
| --- | --- | --- |
| `hrv` | Nonnegative number, `ms` | SDNN HRV only; other HRV measures must not be mixed. |
| `resting_hr` | Positive number, `bpm` | Reported resting heart rate. |
| `sleep_duration` | Nonnegative number, `min` | Reported sleep duration in the session interval. |
| `sleep_start`, `sleep_end` | UTC timestamp string, `iso8601` | Session boundary; value must match the relevant interval boundary. |
| `steps` | Nonnegative integer, `count` | Count in the sample interval. |
| `active_energy` | Nonnegative number, `kcal` | Active energy in the sample interval. |
| `workout_duration` | Nonnegative number, `min` | Workout duration. |
| `workout_avg_hr` | Positive number, `bpm` | Workout average heart rate. |

`MetricSample` has `id`, discriminant `metric`, typed `value`, matching `unit`, `startedAt`, `endedAt`, and `source`. Source contains `type` (`mock` or `apple_health`), `externalId`, optional `device`, and optional `provider`. An optional `sessionId` can link sleep/workout samples. Intervals may be instantaneous but cannot be reversed. Sleep boundary samples carry the full sleep session interval, so sleep start is assigned to the wake date too.

Sample IDs are opaque nonblank strings without surrounding whitespace. External identity is preserved separately; an adapter must create stable canonical IDs for repeated source records. User ownership is attached by the authenticated ingestion context in Stage 1, not trusted from a source payload. Database mapping may use UUIDs without restricting every fixture/source identifier to a UUID.

Additional HealthKit metrics, training load, and sleep efficiency are outside version 1. Register and define them explicitly before activating relationships that use them.

## Subjective Event Registry

The ten keys are frozen. Ratings are numeric **0–10**, including fractional values; the registry provides endpoint wording.

| Key | Value | Endpoint meanings or semantics |
| --- | --- | --- |
| `energy` | Rating | 0 no energy; 10 very energetic. |
| `stress` | Rating | 0 no stress; 10 extremely stressed. |
| `mood` | Rating | 0 very low mood; 10 very positive mood. |
| `soreness` | Rating | 0 no soreness; 10 extreme soreness. |
| `workout_rpe` | Rating | 0 no effort; 10 maximal effort. |
| `alcohol` | `{ consumed, quantity, unit, beverage? }` | Unit is `reported_drinks`: a count of reported beverages, not inferred standard doses. Positive intake allows positive quantity or `null`; explicit absence requires quantity 0. |
| `caffeine` | `{ consumed, amountMg }` | Intake allows positive mg or `null` when dose is unknown; absence requires 0. Do not guess mg from a beverage name. |
| `late_meal` | Boolean | The user explicitly reports eating late; no automatic threshold yet. |
| `illness` | Boolean | Reported illness/symptom presence or explicit absence, not a diagnosis. |
| `pain` | `{ present, location, intensity }` | Present pain can have unknown location/intensity; known intensity is greater than 0, up to 10. Absence requires `location: null`, `intensity: 0`. Intensity anchors: no pain / worst imaginable pain. |

A canonical `SubjectiveEvent` includes `id`, `type`, typed `value`, `occurredAt`, `capturedAt`, `timeZone`, `conversationTurnId`, `extractionConfidence` (0–1 or null), and optional `workoutSessionId`. Occurrence cannot follow capture. Confidence concerns speech extraction, not evidence strength. Illness details beyond the boolean remain transcript context in version 1; the model must not invent a diagnosis or additional structured symptom fields.

`SubjectiveEventDraftSchema` validates extraction candidates without application-owned IDs, capture time, zone, conversation provenance, or workout linkage. Application code resolves user-local dates, supplies those fields, and validates the canonical event. Missing or ambiguous required values must be clarified, not guessed. Identifying the authenticated user and validating referenced turns/sessions belong to persistence orchestration.

`ExtractionDraftResultSchema` and `ExtractionResultSchema` each distinguish `captured`, `nothing_trackable`, and `needs_clarification`. Captured arrays cannot be empty. Clarification contains a known `eventType` and `reason`, with no accepted events. The draft's captured status means a candidate was recognized; only the canonical pipeline can confirm persistence. Version 1 uses all-or-clarify for a statement: mixed partial capture, notes, and replay behavior must be explicitly designed in Stage 4 rather than silently added to these shapes.

## Time and lag conventions

Canonical record instants are ISO strings with a **Z** UTC suffix; adapters normalize source offsets before validation. Calendar dates are validated `YYYY-MM-DD` strings. Each daily row and subjective event carries the user's IANA timezone. UTC storage does not mean UTC calendar grouping. `getLocalDate()` uses the supplied zone; `addCalendarDays()` shifts calendar keys rather than adding 24 hours to an instant.

Sleep is assigned to the date the user wakes. Other metrics use their interval end as their day anchor; subjective observations use occurrence date. Interval splitting, multiple sessions, representative values, and source overlap are Stage 6 aggregation decisions. A range query can return an entire overlapping session rather than clip its meaning.

**Factor date = outcome date minus lagDays.** Only the registry applies that shift; outcome names have no extra “next_day” prefix. The agreed wake-date convention deliberately resolves the original illustrative sleep lag.

| Relationship ID | Factor → outcome | Lag | Method |
| --- | --- | --- | --- |
| `sleep_duration__energy` | Wake-date sleep → same-day energy | 0 | Spearman |
| `alcohol__hrv` | Prior-day alcohol → HRV | 1 | Exposure/control |
| `stress__sleep_duration` | Prior-day stress → following-night sleep on wake date | 1 | Spearman |
| `workout_rpe__energy` | Prior-day workout effort → energy | 1 | Spearman |

Confounder references have their own `feature` and `lagDays`, relative to the same outcome date. Sleep/energy includes same-day illness/stress and prior-day alcohol/RPE. Alcohol/HRV includes same-day sleep/illness and prior-day RPE. Stress/sleep includes prior-day alcohol/caffeine/late meal. RPE/energy includes same-day sleep/illness and prior-day alcohol. These are predefined competing context, not statistical adjustment or causal claims. Serialized definitions must match the immutable graph, including confounder lags.

## Daily features and provenance

`DailyFeatures` has contract version, user ID, date, zone, build timestamp/version, and a strict `features` object containing all 19 registered keys. Each feature is either:

```typescript
{ status: "known", value: /* feature-specific type */, provenance: {
  metricSampleIds: [...], subjectiveEventIds: [...]
} }
// or
{ status: "unknown", reason: "not_observed" /* or not_available, ambiguous, insufficient_coverage */ }
```

A known feature needs source IDs of the appropriate kind. Unknown states cannot carry values. Objective features retain metric types/units; ratings retain event scales. Daily alcohol is a reported boolean exposure, caffeine is known mg, and pain retains its structured value. Unknown caffeine dose cannot become a known daily 0 mg. Explicit negative intake can. Sleep boundaries cannot be reversed.

This freezes representation, not the Stage 6 feature-building algorithm. Domain code does not aggregate samples, choose the latest energy report, or resolve conflicting sources yet.

## Evidence contracts

`RelationshipResult` references one registered ID (method/outcome/lag come from the registry), user, inclusive outcome-date period, actual paired outcome dates, sample count, calculation timestamp/version, status, label, effect, and limitations. Paired dates are unique, within period, and equal sample size. Lagged factor dates may precede that outcome-date period.

Insufficient results use `INSUFFICIENT_DATA`, null effect, and at least one limitation. Evaluated Spearman effects have rho in −1…1; exposure effects have both positive group counts, group medians, median/relative difference, and the correct outcome unit. Group counts sum to sample size; differences must match the reported medians. At least two observations is a structural comparison minimum, **not** the eventual evidence eligibility threshold. Stage 7 chooses substantive criteria.

Anomalies carry numeric metric/value/unit, baseline/period/count, relative difference, direction, and objective provenance. Zero baseline requires null relative difference. The bundle checks current anomaly values and references against known current features.

`EvidenceBundle` contains version, outcome, current `dailyFeatures`, earlier `contextDays`, generation/analysis version, anomalies, results, missing factors, and limitations. Current value is `dailyFeatures.features[outcome]`, avoiding a second potentially contradictory copy. Missing factors are `{ feature, date }`, validated against allowed factor/confounder lags and explicit unknown states in the appropriate context day. Known yesterday/unknown today must not be conflated. Context rows share user/timezone and have unique dates; results match the user, outcome, and analysis version.

Supported labels: `INSUFFICIENT_DATA`, `WEAK_SIGNAL`, `NO_MEANINGFUL_SIGNAL`, `POSSIBLE_ASSOCIATION`, `CONSISTENT_ASSOCIATION`. Schema checks prevent structural contradictions but cannot prove that statistics were computed honestly or that an association is causal. The deterministic engine remains responsible for calculation; the LLM receives evidence for communication only. See [evidence rules](EVIDENCE.md).

## Modes and source interface

Serialized modes are lowercase: `capture`, `morning_checkin`, `post_workout`, `investigate`, `experiment`, `doctor_prep`. Initial modes are capture/morning check-in; initial morning dimensions are energy, soreness, mood, illness. Vocabulary does not enable a feature; later stages implement behavior.

`HealthDataSource.getSamples({ from: Date, to: Date, metrics: Metric[] })` returns `Promise<MetricSample[]>`. Bounds are valid increasing instants with half-open semantics `[from, to)`. Requested metrics are nonempty and unique. Instantaneous samples include the start and exclude the end; interval samples are returned when they overlap, retaining full bounds. `parseHealthDataSourceResponse()` validates records, requested keys, overlaps, and unique batch IDs. Empty results mean no returned samples, not proof of inactivity.

Adapters can be bound to a user's source context; source requests/payloads do not authorize user access. Mock subjective fixtures use a separate seeding path. Neither a mock nor Apple adapter is implemented in Stage 0.

## Change and verification rules

Run `pnpm test`, `pnpm typecheck`, and `pnpm lint` for contract changes; `pnpm build` verifies integration. Tests cover invalid observations, time/lag boundaries, provenance, false-versus-unknown, extraction candidates, graph integrity, evidence counts/units, temporal missing context, and source ranges. The test harness uses TypeScript and Node's built-in runner; emitted files are ignored.

Version 1 changes should update schemas/registries, these semantics, and relevant tests together. Future stages still own database access/identity checks (1), mock generation (2), voice API (3), extraction orchestration (4), interview logic (5), aggregation (6), statistics/thresholds (7), investigation (8), question ranking (9), and native behavior (11–13). Stage 0 implements none of those pipelines.
