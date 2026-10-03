# Architecture notes

This is a target architecture for staged implementation, not a claim that these layers already exist. Preserve the current Next.js + Supabase starter while adding capabilities in roadmap order.

## Current repository baseline

The inspected repository uses Next.js 16.3.8, React 19, TypeScript, pnpm, and `@supabase/supabase-js`. `app/status/page.tsx` displays local/preview/production status and whether public Supabase credentials are present. `lib/supabase.ts` creates a client or returns `null`; `lib/deployment.ts` reads Vercel environment status. Configuration presence is not a connectivity or database-health check.

Stage 0 now provides the shared registries and Zod contracts under `lib/domain/`, and the health-source interface/validation under `lib/health/`. Stage 1 adds seven-table migration SQL, `lib/db/` typed/validated access, browser-owned anonymous demo sessions, and Today/Talk/Evidence/Timeline navigation. The status page stays outside the session boundary. The hosted migration is applied; anonymous Auth is enabled; see [Persistence](PERSISTENCE.md). Stage 2 adds `MockHealthDataSource`, canonical ingestion, separate subjective fixtures, owned batch persistence, paginated range reads, and sample controls. Voice, analytical algorithms, and native integration remain later stages. Setup remains documented in [README](../README.md).

## Data and trust flow

```text
Apple Health → HealthKit → Capacitor adapter ─┐
                                              ├→ HealthDataSource → normalize/ingest → metric_samples
MockHealthDataSource ─────────────────────────┘

User speech → GPT-Live conversation/transcript
           → canonical extractor → schema validation
           → subjective_events (linked to conversation turn)

metric_samples + subjective_events
           → deterministic daily feature builder → daily_features
           → deterministic analytics / allowed relationships
           → EvidenceBundle → explanation layer → GPT-Live / UI
```

The model is an interface and communication layer. It may produce structured extraction candidates, but application schemas validate them before persistence. Analytics reads normalized and validated data, evaluates only the Relationship Registry, and emits evidence with provenance, sample size, effect, and limitations. The model receives the `EvidenceBundle` needed to explain an outcome; it does not invent or calculate evidence.

## Domain and storage boundaries

- Keep domain contracts (registries, schemas, modes, source interface) reusable and independent of framework/database APIs.
- Keep raw `metric_samples` and `subjective_events` separate from derived `daily_features` and `relationship_results`.
- Link subjective events to their source conversation turn. Preserve metric time interval, unit, source/device, and external identifier where available.
- Keep conversation/session persistence separate from canonical event extraction. Extraction results should make `captured`, `nothing_trackable`, and `needs_clarification` explicit.
- Likely Supabase tables as stages mature: `profiles`, `metric_samples`, `subjective_events`, `conversations`, `conversation_turns`, `daily_features`, `relationship_results`, `experiments`, and `experiment_observations`.

## Analytics and question selection

Use simple deterministic methods: personal rolling baselines and robust deviations; anomalies; Spearman correlation for continuous factors; exposure/control comparisons for categorical exposures; registry-defined temporal lags; sample sizes, effect sizes, evidence labels, and known confounders. Do not present association as causation. If relevant factors are unknown, deterministic investigation selects missing context and application logic chooses the next question. GPT may phrase that question but cannot choose a new domain variable or relationship.

## Integration seam

`HealthDataSource.getSamples({ from, to, metrics })` returns canonical `MetricSample[]`. The mock implementation comes first and remains useful for development, demo fallback, and validation. A future Apple implementation owns HealthKit permissions, queries, and native normalization behind this interface. Analytics, persistence, conversation, and UI must not depend on HealthKit APIs.

## Product surface

- **Today:** unusual observations and the next unresolved question, not a composite readiness score.
- **Talk:** voice session, transcript, and capture/check-in interactions.
- **Evidence:** personal relationships, effects, sample sizes, evidence level, and confounders.
- **Timeline:** chronological wearable and conversational observations with provenance.
- **Experiments:** later, for structured personal experiments.

The defining user loop is passive signal → deterministic investigation → missing-context question → validated observation → recomputed evidence. See [`CONTEXT.md`](../CONTEXT.md) for product rules and [`ROADMAP.md`](ROADMAP.md) for stage ownership.

## Layer ownership and dependencies

| Boundary | Owns | Must not own |
| --- | --- | --- |
| Domain | Registries, canonical types, validation semantics, mode vocabulary | Framework/database/native implementation details. |
| Health adapters | Source queries, permissions, source-specific normalization | Subjective extraction or analytical interpretations. |
| Ingestion | Validate canonical records, source identity, persistence/replay behavior | Inventing values to repair unknown inputs. |
| Conversation | Live session, transcript, extraction orchestration, interview state | Statistical evidence or relationship creation. |
| Feature builder | Time alignment, aggregation, raw-to-derived provenance | Model-generated feature values. |
| Analytics | Baselines, comparisons, labels, investigation, question selection inputs | Natural-language interpretation as calculation. |
| Database access | User-scoped queries and persistence of canonical records | Alternate domain definitions embedded in query code. |
| Explanation/UI | Render and communicate accepted observations/evidence | Hidden calculations that disagree with backend results. |

Organize new work around these boundaries using the existing root `app/` and `lib/` conventions. The original `src/domain`, `src/analytics`, etc. sketch describes conceptual modules, not a requirement to move the starter into `src/`. Stage 1 can establish suitable modules under `lib/` as needed. Stage -1 creates no empty code directories or placeholder implementations.

## Storage and access requirements for Stage 1

Initial table candidates: profiles; raw metric samples and subjective events; conversations and turns; daily features; relationship results. Experiment tables belong to Stage 14. Domain schemas map to persistence without becoming dependent on generated database types.

Define ownership/access for user records before storing personal data. Stage 1 must make its demo/test-user strategy explicit and decide authentication and row-level access rules. Shared helpers using public keys do not confer unrestricted access. Any future model-provider credential belongs to server-only configuration. Existing public Supabase variables and the missing-credentials starter behavior remain supported.

Record ingestion identity/replay semantics before repeated sync or capture can create duplicate observations. Stages 2/4 establish repeatable mock ingestion/capture; Stage 13 hardens source-specific duplicate handling with real data. Stage 6 defines how changed observations invalidate or rebuild features, and later analytical results must use the updated feature state. Mock replay is implemented in Stage 2 as documented in [Fixtures](FIXTURES.md). Capture replay, derived-data invalidation, and real-source handling remain responsibilities of their owning stages.

## Native/web collaboration

Web/backend ownership covers Next.js, Supabase, registries/schemas, conversation, interviewer, analytics, investigation, and UI. Native ownership covers Capacitor, iOS project, HealthKit permissions, queries, and source normalization. Both sides agree the `HealthDataSource` semantics in Stage 0 before exchanging data.

Capacitor does not make Next.js server features execute inside iOS. Stage 11 must choose how the shell loads the web application and reaches hosted backend/session endpoints while preserving server responsibilities. Do not assume static export works for future server routes. Keep transport decisions separate from canonical sample meaning. Real samples enter the existing ingestion/feature/analytics pipeline.

## Decision record and unresolved choices

The following decisions are settled by the project context: preserve Next.js/Supabase; code owns evidence; registries bound the domain; extraction is separate from live conversation; mock and Apple data share a source contract; raw and derived data stay separate; native integration arrives late.

| Open choice | Owner stage | Record the result in |
| --- | --- | --- |
| Initial registry entries, units/scales, timestamps, range semantics, lag alignment — resolved in version 1 | 0 complete | [Domain contracts](DOMAIN.md) and `lib/domain/` |
| Auth/demo user, user isolation, migrations, query ownership — implemented; migrations applied, anonymous Auth enabled, acceptance checked | 1 | [Persistence](PERSISTENCE.md) |
| Mock objective/subjective fixtures, planted patterns, seed/reset behavior — implemented | 2 complete | [Fixtures](FIXTURES.md) |
| Concrete voice API, session authorization and persistence | 3 | Conversation and integration guidance |
| Mixed utterances, partial capture, confirmation/replay semantics | 4 | Conversation/domain contracts |
| Check-in completion/resumption rules | 5 | Conversation |
| Aggregation, day assignment, source overlap, rebuild policy | 6 | Domain/evidence |
| Baseline windows, eligible counts, evidence thresholds | 7 | Evidence and analytics contracts |
| Question ranking, ties, unavailable/skipped context | 9 | Conversation/evidence |
| Shell loading/backend connectivity and native transport | 11 | Architecture |
| Real permissions, normalization, synchronization and source deduplication | 12–13 | Adapter guidance |
| Experiment eligibility, duration, summaries and limitations | 14 | Domain/evidence |

When a choice is implemented, update its owning document rather than leaving an unresolved question beside contradictory code. New decisions changing the product thesis must also update `CONTEXT.md`.

## Stage 3 voice boundary

Capture-only WebRTC now runs through `lib/conversation/`, the Talk component, and authenticated `/api/voice/session`. The server verifies the Supabase JWT and forwards SDP with server-selected provider configuration; the browser receives no provider key. Final transcript turns use existing raw persistence, with expected-owner checks and a same-tab recovery queue. No new migration, health-event tool, or analytics exists in this stage. See [VOICE](VOICE.md) for finalization, cleanup, limitations, and pending live acceptance.
