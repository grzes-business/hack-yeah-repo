# Stage 13 — Real-data hardening

## Status and intended outcome

**Implemented 2026-10-04 with a deidentified case matrix; travel, device replacement and HealthKit deletions remain untested. See [HEALTHKIT](../HEALTHKIT.md#real-data-policies-and-case-matrix-stage-13).**

Documented real-source cases produce expected canonical and derived results, and the demo survives realistic history/sync limitations.

**Dependencies:** [Stage 12](stage-12-healthkit-adapter.md), with feature/result freshness from Stages 6–8.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [architecture](../ARCHITECTURE.md), [domain](../DOMAIN.md), [evidence](../EVIDENCE.md), and [fixtures](../FIXTURES.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

The adapter can ingest real records, but the first successful device query does not establish correctness across historical edge cases. Use team-member history only with permission; shared regression fixtures should be minimized/deidentified rather than committing identifiable exports.

## Implementation work

1. Build a case matrix from consented real history: duplicate exports, overlapping devices/providers, missing metrics, DST/travel/time-zone changes, segmented sleep, partial workouts, device replacement, units, corrections/deletions, and incremental sync failures.
2. Establish human-checked expected normalized records and aggregates for representative cases. Capture source/device/OS versions and coverage; distinguish observed expectations from assumed clinical meaning.
3. Settle source identity and overlap policy. Repair HealthKit serialization/query/session quirks in the adapter/normalization layer. If a genuinely source-independent aggregation defect is found, change the Stage 6 manifest explicitly and version/rebuild affected output.
4. Define incremental cursors/ranges, overlap on retry, deleted-record handling, offline/partial-sync recovery, and resumption. A failed or empty query cannot by itself authorize deleting existing history; deletion requires the declared source evidence/policy.
5. Verify that corrections/deletions invalidate affected features, lag-dependent results, and bundles; no stale evidence survives as current. Repeated sync should not inflate sums or create repeated sessions.
6. Retest mock/source parity and unsupported-device fallback. Keep fictional and real history distinguishable; any mixed-source policy must be explicit rather than silently merging fixture and real evidence.
7. Record practical demo limits, tested cases, unsupported histories/keys, and recovery/reset instructions. Do not broaden the registry to conceal an adapter mismatch.

## Decisions and constraints

Resolve real-source priority/dedup rules, authoritative deletion evidence, cursor lifetime, and time-zone history policy with actual cases. Device changes do not automatically define a new personal baseline; any analytical policy change is versioned in EVIDENCE. Preserve user privacy in issue attachments and test fixtures.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S13-AC01:** The case matrix identifies tested inputs, expected canonical/derived output, actual results, and known unresolved cases without treating untested cases as passed.
- **S13-AC02:** Duplicate/multiple-source/partial-session cases do not inflate measures; documented source/aggregation rules explain the selected result.
- **S13-AC03:** DST/time-zone/unit/device-change cases preserve canonical identity/time/value semantics and expected daily assignment.
- **S13-AC04:** Repeated/incremental/interrupted sync is resumable and idempotent; failed or empty queries do not silently erase previously stored history.
- **S13-AC05:** Proven source corrections/deletions refresh dependent features/results/bundles and prevent stale evidence being served as current.
- **S13-AC06:** Mock fixtures and real canonical fixtures exercise the same product logic; fallback remains available and truthfully labeled.
- **S13-AC07:** Shared fixtures/logs contain no unnecessary identifiable health data; tested device/source versions and remaining demo limits are documented.

## Verification and completion record

Compare human-verified exports to normalized records and selected daily aggregates. Run regression cases for every repaired bug, replay/partial-sync/removal checks, and a real-device end-to-end investigation. Rehearse both real-history and mock fallback demos; avoid claiming clinical validation.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Arbitrary new health variables, causal model fitting, native analytics, and automatic diagnosis/treatment based on noisy history.

## Documentation handoff

Update the HealthKit/source reference and ARCHITECTURE with real reconciliation/sync policies; DOMAIN/EVIDENCE for explicit shared-policy changes; DEMO with actual device and fallback limits.

## Completion record — 2026-10-04

Case matrix C1–C7 passes (`lib/health/apple-health-cases.test.ts`). One shared defect found and fixed explicitly: day assignment now treats interval ends as exclusive (daily totals ending at local midnight were assigned to the next day); documented in [DAILY-FEATURES](../DAILY-FEATURES.md). Source, deletion and freshness policies are in [HEALTHKIT](../HEALTHKIT.md). No identifiable exports are committed. Untested: time-zone travel, device replacement, HealthKit deletions, comparison of synced records to a human-checked export.
