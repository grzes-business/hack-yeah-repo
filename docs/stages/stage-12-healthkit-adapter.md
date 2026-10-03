# Stage 12 — Apple Health source adapter

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

Real registered Apple measurements enter the existing pipeline with correct units, intervals, ownership, and source provenance.

**Dependencies:** [Stage 11](stage-11-capacitor-shell.md), existing canonical ingestion from Stage 2 and feature/analytics pipeline from Stages 6–8.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [architecture](../ARCHITECTURE.md), [domain](../DOMAIN.md), [fixtures](../FIXTURES.md), and [persistence](../PERSISTENCE.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

`HealthDataSource` and canonical ingestion already work with mock records. No `AppleHealthDataSource` exists yet. The adapter must return the same validated `MetricSample[]`; HealthKit raw objects never become an alternate product-domain contract.

## Implementation work

1. Verify current official HealthKit/bridge APIs and platform permission semantics. Request only scopes required for registered metrics, using accurate permission descriptions. Separate capability availability, authorization-request outcome, and observed data coverage; an empty read is not proof of read denial.
2. Implement source queries for the nine keys when supported. Preserve SDNN HRV semantics, bpm, minutes, kcal, counts, and UTC instants. Define sleep interval/session normalization and workout duration/average HR derivation from actual supported source records; do not relabel incompatible measurements.
3. Honor requested metric filters and [from,to) interval overlap without clipping. Normalize source/device/provider metadata and stable external IDs so replay/upsert is idempotent. Validate the whole response through the shared contract before ingestion.
4. Keep platform serialization/query failures inside the adapter. Report unavailable/empty/failed states truthfully through a documented status boundary; missing measurements never become zero activity or healthy absence.
5. Send canonical results through authenticated owner-scoped ingestion. Define basic sync range, retry, deduplication, and identity semantics. Native permission does not authorize writing another user’s records.
6. Exercise existing feature/analytics/investigation with normalized real input. If units/timing require fixes, make them at adapter/normalization boundaries; shared rules remain explicit and source-independent.
7. Retain selectable mock fallback with clear provenance, including when HealthKit is unsupported or there is no usable history. Do not silently substitute fictional data as real.

## Decisions and constraints

Resolve plugin/API choice, sleep record grouping, average-HR availability, identifier mapping, and status reporting. Platform read privacy may prevent distinguishing no history from denied access; follow official semantics rather than guessing. Unsupported metrics remain unavailable, not inferred. Complex multiple-source reconciliation and real-case hardening continue in Stage 13.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S12-AC01:** On a supported physical device, permitted available registered measurements normalize to schema-valid values, units, full intervals, and source/external IDs.
- **S12-AC02:** Only requested registered metrics are returned; SDNN is not replaced by another HRV definition, and sleep boundary/duration records remain internally consistent.
- **S12-AC03:** Range overlap, UTC/local-date semantics, replay/retry, and stable identity behave consistently with mock ingestion.
- **S12-AC04:** Unsupported, empty, limited, revoked, and failed query situations are handled according to documented platform semantics without manufactured zero/false samples.
- **S12-AC05:** Canonical ingestion is authenticated/owner-scoped and validates responses; native/provider secrets are not exposed.
- **S12-AC06:** The same feature/analytics path accepts real normalized records without source-specific evidence branches.
- **S12-AC07:** Mock fallback remains available and explicitly synthetic; device/OS/plugin versions, tested permissions, and unsupported keys are documented.

## Verification and completion record

Use adapter fixtures for unit/time/session/ID normalization and actual device checks for permission request, available history, missing coverage, retry, and unavailable/revoked scenarios the platform permits observing. Compare selected canonical samples to source records manually. A simulator or generated fixture cannot certify real HealthKit access.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

New metrics/relationships, diagnosing source gaps, native evidence calculations, and claiming all real histories are hardened.

## Documentation handoff

Add a focused HealthKit source reference if necessary and route it from AGENTS/ARCHITECTURE. Record metric mappings, status semantics, device checks, and known coverage limits.
