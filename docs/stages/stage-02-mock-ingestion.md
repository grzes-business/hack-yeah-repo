# Stage 2 — Mock source and canonical ingestion

## Status and intended outcome

**Implemented; acceptance checkpoint: 2026-10-03. Recheck affected criteria when changing behavior.**

Repeatable wearable-like and conversational history exercises real validation, private persistence, replay, range reads, and removal before HealthKit exists.

**Dependencies:** [Stages 0](stage-00-domain-contracts.md) and [1](stage-01-web-persistence.md).

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [fixtures](../FIXTURES.md), [persistence](../PERSISTENCE.md), and [demo](../DEMO.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Implemented modules: `lib/demo/scenario.ts`, `subjective-fixtures.ts`, `seed.ts`; `lib/health/mock-data-source.ts`, `ingestion.ts`; `lib/db/ingestion.ts`; `app/components/demo-history.tsx`. The metric-interval migration `202610030002_metric_intervals.sql` is applied. Timeline uses bounded display reads; repository range reads are paginated for full-history consumers.

## Implementation work

1. Preserve the versioned deterministic recipe: 56 days by default (configurable 1–60), seed 2026, explicit end date and IANA zone. Key randomness by day/channel so overlapping windows produce identical records. IDs use the version/seed/zone namespace; recipe changes require identity/version consideration.
2. Implement all nine objective keys through `HealthDataSource`, filtering requested metrics and overlapping intervals without clipping. Return validated copies rather than mutable shared fixture objects.
3. Keep subjective fixtures on a separate canonical event/conversation/turn path. Mark retrospective synthetic transcripts; preserve occurrence versus capture time, unknown extraction confidence, and workout session linkage.
4. Preserve planted sleep→energy, alcohol→HRV, stress→sleep, RPE→energy patterns plus noise, explicit negative reports, omitted samples/events, and unknown doses. Latent recipe values must never fill missing features or serve as calculated user evidence.
5. Validate entire source/fixture responses before writes. Persist objective samples, then conversation/turn/event dependencies. Upsert stable identities, count only confirmed writes, and expose partial failures honestly. Multi-batch/multi-table setup is resumable, not atomic.
6. Read full ranges through paginated owner-verified repositories. Preserve exact [from,to) semantics for event occurrence and metric interval overlap. Enforce canonical payload/metadata consistency.
7. Load/remove from Today and expose synthetic provenance in Timeline. Removal targets only the current owner’s selected fixture namespace and mock source. Repeated load is idempotent; extending a window retains older records. Exact replacement requires remove then load.

## Decisions and constraints

Current reference: seed 2026, Europe/Warsaw, end 2026-10-02, 56 days produces 459 metric samples, 529 events, 56 conversations, and 56 turns (2026-08-08 through 2026-10-02). Counts belong to this recipe/input, not a universal data guarantee. Time zone changes create a different namespace. Concurrent load/reset is unsupported; UI operations are serialized. Derived invalidation must be added in Stage 6 before activating analytics.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S02-AC01:** Identical inputs produce identical canonical values/IDs, and overlapping windows agree for shared dates; no current clock or mutable random state alters an explicitly anchored scenario.
- **S02-AC02:** All returned samples/events validate; source metric filtering, interval overlap, DST handling, sleep sessions, and workout/event linkage follow Stage 0.
- **S02-AC03:** The documented reference fixture matches its counts and includes each planted relationship, intentional gaps, explicit negatives, and unknown values.
- **S02-AC04:** Invalid source responses are rejected before writes; batch failures report confirmed progress and do not display a false completed setup.
- **S02-AC05:** Repeated load creates no duplicates; retry can complete partial setup; paginated range reads return the complete selected history.
- **S02-AC06:** Removal preserves other users, Apple-source records, and unrelated raw records; selected fixture records are confirmed removed.
- **S02-AC07:** Today and Timeline clearly label fictional history; loading, failure, removal, and session reload behave consistently.

## Verification and completion record

Checkpoint 2026-10-03: 30 combined tests passed, build/lint/types passed, hosted replay/range/removal/ownership checks and browser load/reset/reload passed. New recipe changes need deterministic fixture tests and updated reference counts. Synthetic checks establish implementation correctness, not clinical validity.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

HealthKit, daily features, analytical results, live capture, and a global account reset.

## Documentation handoff

Update FIXTURES for recipe, namespace, gaps, failure and reset semantics; PERSISTENCE for interval/query changes; DEMO for the current available milestone.
