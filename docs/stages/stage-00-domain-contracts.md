# Stage 0 — Domain contracts

## Status and intended outcome

**Implemented; acceptance checkpoint: 2026-10-03. Recheck affected criteria when changing behavior.**

One validated version 1 vocabulary and source interface governs mock ingestion, extraction, storage, daily features, and evidence.

**Dependencies:** [Stage -1](stage-minus-1-context.md).

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [domain](../DOMAIN.md) and [architecture](../ARCHITECTURE.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

The implemented import surface is `lib/domain/index.ts`; schemas are in `lib/domain/{primitives,metrics,events,features,relationships,agent-modes,evidence}.ts`. The health-source contract is `lib/health/data-source.ts`. Existing domain/source tests describe boundary behavior. These contracts are framework-independent.

## Implementation work

1. Preserve the nine metric keys: `hrv`, `resting_hr`, `sleep_duration`, `sleep_start`, `sleep_end`, `steps`, `active_energy`, `workout_duration`, `workout_avg_hr`. Preserve declared units and bounds; HRV means SDNN in milliseconds. Sleep boundary samples carry the full sleep interval; timestamp values match the corresponding interval bound.
2. Preserve the ten event types: energy, stress, mood, soreness, workout RPE, alcohol, caffeine, late meal, illness, pain. Numeric ratings use 0–10 with explicit endpoint anchors. Distinguish a reported negative from unknown quantity/intensity. Do not infer alcohol dose or a diagnosis.
3. Preserve application-owned canonical fields and model-facing drafts. A draft does not supply accepted IDs, capture time, user time zone, conversation provenance, or workout linkage. Extraction outcomes are `captured`, `nothing_trackable`, and `needs_clarification`; version 1 uses all-or-clarify for an utterance.
4. Preserve UTC instants, IANA time zones, valid local dates, inclusive analysis periods, and half-open source ranges. Sleep belongs to wake date. Other metric samples use interval end for daily assignment. Calendar-day shifts must work across DST.
5. Preserve the four relationships: sleep duration→same-day energy (lag 0, Spearman); prior-day alcohol→HRV (lag 1, exposure comparison); prior-day stress→sleep duration (lag 1, Spearman); prior-day workout RPE→energy (lag 1, Spearman). Confounders retain their own registered lags relative to outcome date.
6. Preserve all 19 required daily feature keys with typed known values/provenance or explicit unknown reasons. Validate relationship results, anomaly records, and bundles for ownership/date/count/method/unit consistency. Preserve lowercase `capture`, `morning_checkin`, `post_workout`, `investigate`, `experiment`, `doctor_prep` modes; an enum value alone does not enable a feature.
7. Keep `HealthDataSource.getSamples()` source-independent: valid increasing dates, unique nonempty requested metric keys, overlapping intervals, un-clipped canonical samples, and validated unique response IDs.

## Decisions and constraints

The metric/event sets, rating scale, wake-date sleep, and four relationships are settled. Schema validation is not evidence eligibility: the structural minimum of two evaluated pairs does not establish a scientifically useful signal. No algorithm, threshold, or aggregation policy is approved merely by having a schema. Contract changes require explicit version/compatibility handling and canonical documentation changes.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S00-AC01:** Unknown metric/event/relationship IDs and malformed values fail shared validation; units, rating bounds, and conditional negative/unknown event semantics are enforced.
- **S00-AC02:** Invalid instants, dates, zones, reversed intervals, duplicate range keys, and inconsistent sleep boundary values are rejected.
- **S00-AC03:** Canonical provenance cannot be supplied by an extraction draft; canonical accepted events can represent their source turn and unknown values.
- **S00-AC04:** Daily features contain every registered feature and distinguish unknown from a legitimate zero or false; known features carry valid source references.
- **S00-AC05:** Relationship definitions validate against the exact graph; alignment examples use outcome date minus lag once, including confounder dates.
- **S00-AC06:** Evidence validation rejects inconsistent owner/time zone, pair counts/dates, effect methods/units/arithmetic, and missing-context references.
- **S00-AC07:** The source contract supports empty results and full interval overlap without inferring inactivity; domain imports require no Next.js, Supabase, provider SDK, or HealthKit.

## Verification and completion record

When changing contracts, run focused contract/source cases for valid and invalid values, DST/date shifts, overlap boundaries, lag alignment, missingness, and bundle consistency. The 2026-10-03 checkpoint passed; retain compatibility examples in the relevant tests.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Database implementation, feature aggregation, analytical calculations, LLM extraction execution, and source adapters.

## Documentation handoff

Update DOMAIN and any consumers affected by deliberate schema evolution. Record migration/compatibility consequences before changing a frozen definition.
