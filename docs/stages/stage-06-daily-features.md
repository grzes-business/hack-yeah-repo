# Stage 6 — Deterministic daily feature pipeline

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

Canonical raw observations produce reproducible, provenance-backed daily rows with explicit unknowns, regardless of source adapter.

**Dependencies:** [Stage 2](stage-02-mock-ingestion.md) and [Stage 4](stage-04-structured-observations.md), using Stage 0 contracts. Pure builder work can begin on fixtures; final acceptance includes captured-event inputs.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [domain](../DOMAIN.md), [evidence](../EVIDENCE.md), [fixtures](../FIXTURES.md), and [persistence](../PERSISTENCE.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

The complete 19-key `DailyFeatures` schema and derived table exist, but no builder or authorized server writer exists. Reuse full paginated raw range reads; Timeline’s display cap is unsuitable for analytics. Stage 2 raw removal currently has no derived invalidation because no derived pipeline is active.

## Implementation work

1. Define an aggregation manifest for every feature: eligible raw keys, units, local-day assignment, source/session deduplication, summary rule, minimum coverage, conflict handling, and unknown reason. Explicitly decide multiple HRV/ratings, sleep segments/sessions, workout summaries, and corrected subjective reports.
2. Preserve wake-date sleep and metric end-date semantics. Fetch enough overlapping source history for overnight intervals; avoid clipped sleep durations. Handle DST/calendar arithmetic and time-zone changes deliberately. Do not distribute samples across days using an undocumented alternative policy.
3. Build pure functions from validated samples/events to all 19 typed feature states. Keep absent data unknown; retain legitimate zero/false. Consumed caffeine with unknown mg is not zero. Omitted workout/RPE does not prove rest. Preserve raw references for each known feature.
4. Add authenticated server orchestration for single-day and range rebuilds. Derive owner from verified auth; use narrowly controlled derived writes, never a browser-exposed privileged key. Validate output before storing.
5. Declare builder version, input-consistency strategy, and storage identity `(user,date,zone,builderVersion)`. Reads spanning pages are not automatically a snapshot; choose an explicit consistent-generation strategy so a concurrent change cannot silently mix generations.
6. Add dirty/invalidation behavior for raw insert, correction, deletion, fixture removal, and source sync. Rebuild affected dates and invalidate dependent baselines/results/bundles when those features change. Account for registered lag dependencies; define freshness before Stage 7 reads derived rows.
7. Keep raw data immutable unless an explicit correction/removal action applies. Expose builder coverage/errors for later UI without interpreting them as evidence strength.

## Decisions and constraints

Stage 0 fixes representation and day semantics, not aggregation formulas. Freeze the per-feature manifest and conflict/source-overlap rules here at implementation time. New training-load formulas/features need explicit registry changes; do not smuggle them into the 19-key schema. Different zones/versions must not silently share stale rows. A full range rebuild must use complete input reads.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S06-AC01:** Every built row validates and contains all 19 feature states; known values have owned existing raw provenance and declared aggregation.
- **S06-AC02:** Identical canonical inputs, zone, and builder version yield identical analytical values/provenance, regardless of mock or Apple source labels.
- **S06-AC03:** Absent data, explicit negatives/zeros, unknown doses, conflicting reports, and insufficient coverage produce their declared distinct states.
- **S06-AC04:** Wake-date sleep, cross-midnight intervals, lag boundary context, and DST days match documented examples without clipping or double counting.
- **S06-AC05:** Range building uses complete paginated history and matches independent per-day builds under the same consistent input generation.
- **S06-AC06:** Replay/rebuild does not duplicate derived rows; owner isolation and browser write denial hold for the new server writer.
- **S06-AC07:** Raw corrections/deletions/removal mark affected derived data and downstream dependencies stale or rebuild them; old results cannot be served as current.
- **S06-AC08:** The aggregation manifest, builder version, and generation/freshness policy are recorded before analytical consumers rely on them.

## Verification and completion record

Use hand-calculated small histories for each feature, then the 56-day fixtures. Include duplicates, source overlap, repeated ratings, unknown doses, missing sleep, multiple workouts, DST, source-label parity, concurrent input generation, and raw removal/rebuild. Verify server ownership and derived write permissions separately.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Baselines, anomaly thresholds, relationship statistics, evidence labels, model explanations, and real HealthKit querying.

## Documentation handoff

Update DOMAIN/EVIDENCE with the aggregation manifest, PERSISTENCE with writer/freshness semantics, FIXTURES with derived invalidation on removal, and ARCHITECTURE with the actual builder modules.
