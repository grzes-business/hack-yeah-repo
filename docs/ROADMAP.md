# Implementation roadmap

This roadmap records stage boundaries and outcomes. The order is intentional: prove product and analytics with mock data before native HealthKit access. **Stages -1 through 2 are implemented. Stage 1 acceptance checks passed; Stage 2 fixtures, hosted ingestion/replay/range reads/removal, and the sample UI are verified. Stage 3 voice/transcript implementation is in place with live acceptance pending; The user confirmed live voice works. Stage 4 structured capture is implemented with behavioral acceptance pending; Stage 4.5 voice reliability is implemented with acceptance gaps before Stage 5.** Future GitHub issues should link to this roadmap and [`CONTEXT.md`](../CONTEXT.md), then define stage-specific scope, acceptance criteria, and dependencies. A roadmap entry alone does not authorize implementation.

| Stage | Umbrella scope | Outcome |
|---|---|---|
| **-1 — Project context** | Establish canonical product context, architecture notes, roadmap, and agent reading/routing instructions. | Agents can understand the product, constraints, and planned sequence. |
| **0 — Domain contracts** | Define Metric, Subjective Event, and Relationship registries; `AgentMode`; shared schemas for `MetricSample`, `SubjectiveEvent`, `DailyFeatures`, and `EvidenceBundle`; `HealthDataSource`; validation conventions. Keep domain definitions independent of app, database, model, and native integrations. | Stable contracts for all later stages. |
| **1 — Web/backend foundation** | Organize domain, analytics, conversation, health, and database boundaries; configure current Next.js/Supabase foundation, migrations and typed database access; create core tables; demo/test user flow; minimal Today, Talk, Evidence, and Timeline shell. | Application foundation able to store and display health information. |
| **2 — Mock ingestion** | Implement `MockHealthDataSource`, roughly 45–60 days of realistic synthetic history with known relationships, canonical ingestion into `metric_samples`, deterministic fixtures. | Wearable-like data exercises the real pipeline before HealthKit. |
| **3 — GPT-Live conversation** | `/talk` microphone/session controls and transcript; low-latency voice; persistence boundaries; begin with `CAPTURE` mode only, with no health reasoning. Keep event extraction separate. | Natural conversation with persistent transcript. |
| **4 — Structured observations** | Canonical transcript → extraction → validation → persistence; predefined event types; `captured`, `nothing_trackable`, and `needs_clarification` outcomes; turn provenance and UI visibility. | Speech reliably creates validated observations. |
| **4.5 — Voice reliability** | Control audio/response turns, confirmed capture feedback, spoken clarification/correction, bounded owned retrieval, communication rules, and live regression acceptance. | Usable, grounded voice interaction before adding interviews. |
| **5 — Deterministic check-ins** | Application-controlled `getNextQuestion()` for energy, soreness, mood, illness; track known/missing/clarification state; model only phrases the selected question. Leave room for later interview modes. | Repeatable active sensing. |
| **6 — Daily features** | `buildDailyFeatures()` and range rebuilding; aggregation, missing values, date boundaries, provenance; raw/derived separation; identical behavior for mock and Apple sources. | Stable analytical daily dataset independent of source. |
| **7 — Deterministic analytics** | Personal robust baselines and anomaly detection; Spearman and exposure comparisons; registry-defined lags; sample sizes, effect sizes, conservative evidence classifications; validate against planted mock relationships. | Factual personal patterns without LLM inference. |
| **8 — Evidence-backed investigation** | `investigateOutcome()` orchestration; structured `EvidenceBundle` with anomalies, relationships, strength, and context; `INVESTIGATE` mode; explain uncertainty and association/non-causality. | Voice explanations grounded in calculated evidence. |
| **9 — Missing evidence and active sensing** | Detect relevant unknown context; deterministic `selectBestQuestion()` from predefined knowledge; ask one high-value question; persist answer and rerun; show before/after evidence. | Demonstrate detect → identify missing context → ask → capture → recompute. |
| **10 — Evidence-first UI** | Polish Today around anomalies and open questions; Evidence relationships/effects/sample sizes/confounders; Timeline for wearable and voice observations; clear provenance and uncertainty; support demo narrative. | UI expresses investigation rather than a generic wearable dashboard. |
| **10A — Mobile product design** | Specify Today/Talk/Evidence/Timeline hierarchy, phone navigation, state/action mapping, wireframes and visual/accessibility rules. May start before backend evidence stages finish. | Reviewed design ready for implementation. |
| **10B — Mobile UI implementation** | Implement the accepted design in Next.js, connect real controllers/evidence, and verify phone layouts, accessibility, failure recovery and the complete demo. | Usable mobile web app before Capacitor. |
| **11 — Capacitor shell** | Wrap the stable web application; establish native/web communication and iOS project/permissions groundwork; keep analytics out of native layer. | Existing application runs in an iOS-capable shell. |
| **12 — HealthKit adapter** | Implement `AppleHealthDataSource`; request appropriate permissions; query only registered metrics; normalize to `MetricSample[]` with timestamps, units, source/device, and external IDs; use existing ingestion. | Real Apple data replaces mock input without changing product logic. |
| **13 — Real-data hardening** | Validate against team member history; handle duplicates, multiple sources, gaps, time zones, partial sessions, device changes, and units; settle aggregation/deduplication; keep fixes in adapter/normalization. | Reliable demo on real history. |
| **14 — Personal experiments** | Add `EXPERIMENT` mode and domain models; turn uncertain predefined relationships into N-of-1 proposals with outcomes, duration, inclusion criteria, confounders; descriptive baseline/intervention comparison and conservative conclusions. | Uncertain evidence can lead to a practical next step without medical causal claims. |

## Detailed implementation guides

Read the [stage index](stages/README.md) and the linked stage guide for implementation work, decisions, stable AC IDs, verification, and handoff. This roadmap retains umbrella scope and ordering; guides distinguish completed checkpoints from future work.

## Issue-writing guidance

- Use one concise umbrella issue per stage; link this roadmap, `CONTEXT.md`, and the relevant stage guide/AC IDs instead of copying a second specification.
- Include the stage outcome, in-scope work, explicit exclusions/dependencies, and observable acceptance criteria. Split implementation details into child issues only when they can be worked and reviewed independently.
- Stage 0 should be completed before downstream code assumes domain types. Stage 11 follows a stable browser/backend experience; Stage 12 follows the `HealthDataSource` contract; Stage 14 follows the evidence engine.
- Record contract changes in their canonical docs and update [`AGENTS.md`](../AGENTS.md) routing when new guidance is introduced.

## Stage completion and boundaries

The table above is the umbrella overview. The criteria below make each stage reviewable without defining premature APIs or numerical thresholds. Dependencies describe the intended implementation sequence; they are not a requirement to create every future issue immediately.

### Stage -1 — Shared project knowledge

Detailed guide: [Stage -1 — Shared project knowledge](stages/stage-minus-1-context.md).

Deliver `CONTEXT.md`, agent routing, architecture/domain/conversation/evidence/demo references, and this roadmap. A new contributor should be able to explain the product and evidence boundary, find the mock/native seam, distinguish current code from planned work, and identify unresolved decisions.

Done when documentation links resolve, terminology is consistent, later-stage examples are clearly marked, and the starter remains intact. Scope is documentation only: no dependencies, migrations, schemas, or product code.

### Stage 0 — Freeze domain contracts

Detailed guide: [Stage 0 — Domain contracts](stages/stage-00-domain-contracts.md).

Status: implemented in `lib/domain/` and `lib/health/data-source.ts`, with contract validation tests. [DOMAIN.md](DOMAIN.md) records the frozen version 1 choices and import surface.

Use [domain requirements](DOMAIN.md). Resolve initial registries, units/scales, time/range semantics, relationship alignment, modes, core records, and source abstraction. Define reusable validation independently from integrations.

Done when mock, extraction, and analytics developers can consume one set of contracts; invalid/unknown identifiers fail validation; missingness and provenance are representable; lag examples cannot double-shift outcomes. Excludes persistence implementations and analytical algorithms. Depends on Stage -1.

### Stage 1 — Application and persistence foundation

Detailed guide: [Stage 1 — Web and persistence foundation](stages/stage-01-web-persistence.md).

Status: shell, demo session flow, typed repository, and seven-table migration implemented. The migration is applied with all seven tables using RLS. Anonymous Auth is enabled; browser demo/profile restoration, live ownership/provenance/permission checks, and missing-credential build/render passed. See [Persistence](PERSISTENCE.md) for setup and remaining acceptance checks.

Extend the existing Next.js/Supabase setup with suitable module boundaries, migrations/typed access, user ownership, and a documented demo/test-user flow. Create core storage and minimal navigation. Preserve starter configuration conventions.

Done when the chosen user can store/read their intended records under documented access rules, the shell exposes planned areas, and missing credentials still allow the starter to build/render. Excludes voice, analytics, and native work. Depends on Stage 0.

### Stage 2 — Mock source and ingestion

Detailed guide: [Stage 2 — Mock source and canonical ingestion](stages/stage-02-mock-ingestion.md).

Status: implemented and verified. [Fixtures](FIXTURES.md) owns the versioned 56-day recipe, planted relationships/gaps, stable IDs, separate subjective fixtures, retry/reset semantics, and complete range reads. The interval migration is applied to hosted Supabase.

Implement the source contract and canonical objective ingestion. Seed roughly 45–60 days with realistic variation and deliberate patterns. Define a separate subjective fixture path to support those patterns; record seed/ground truth/reset behavior.

Done when repeated demo setup is predictable, normalized samples pass the shared contract, and downstream work has fixtures including known relationships and gaps. Excludes real HealthKit. Depends on Stages 0–1; fixtures support Stage 7 validation.

### Stage 3 — Live voice

Status: implemented; type/lint/build passed, live/provider/browser and hosted transcript checks pending. See [VOICE](VOICE.md).

Detailed guide: [Stage 3 — Live voice and persistent transcript](stages/stage-03-live-voice.md).

Create `/talk`, session/microphone controls, transcript display, and conversation persistence boundaries in capture mode. Select and document the concrete integration; provider secrets remain server-only.

Done when speech produces persisted turns and session/microphone failures are understandable. No analytical explanations or canonical event extraction required yet. Depends on Stages 0–1.

### Stage 4 — Canonical event extraction

Status: implemented; hosted extraction migration applied, types/lint/build passed. Live/integration acceptance remains pending. See [CAPTURE](CAPTURE.md).

Detailed guide: [Stage 4 — Canonical structured observations](stages/stage-04-structured-observations.md).

Implement [capture flow](CONVERSATION.md), validation, accepted event persistence, provenance, and captured-observation UI. Define mixed/partial input and replay semantics.

Done when known speech yields validated events, ambiguous speech triggers clarification, unknown speech creates no invented variable, and confirmation matches persistence. Excludes autonomous question choice and analytics. Depends on Stages 0–1 and 3.

### Stage 4.5 — Voice reliability and grounded conversation

Detailed guide: [Stage 4.5](stages/stage-04a-voice-reliability.md).

Depends on implemented Stages 3–4. Done when deliberate turn-taking, truthful save feedback, spoken clarification/correction, and owned saved-report retrieval pass documented controller/provider/hosted/microphone checks (`S045-AC01`–`S045-AC10`). Preserve existing stage numbers and distinguish prior fixes from full acceptance. This is the next priority before Stage 5.

### Stage 5 — Deterministic morning check-in

Detailed guide: [Stage 5 — Deterministic morning check-ins](stages/stage-05-deterministic-check-ins.md).

Application logic selects energy, soreness, mood, or illness questions; the model phrases them. Track known/missing/clarification state and interview completion/resumption.

Done when multi-dimension answers update state, known dimensions are not repeatedly requested, and completion follows application rules. Post-workout is an extension seam, not required scope. Depends on Stage 4 and the Stage 4.5 voice reliability gate.

### Stage 6 — Daily feature pipeline

Detailed guide: [Stage 6 — Deterministic daily feature pipeline](stages/stage-06-daily-features.md).

Implement daily/range building with declared aggregation, date boundaries, missingness, source overlap, and provenance. Keep raw records separate; define rebuild behavior after changed input.

Done when the same canonical inputs yield consistent features across sources, unknown differs from zero/false, and range rebuilds reproduce defined results. Excludes evidence interpretation. Depends on Stages 2 and 4, using Stage 0 contracts.

### Stage 7 — Deterministic statistics

Detailed guide: [Stage 7 — Deterministic analytics](stages/stage-07-deterministic-analytics.md).

Implement [evidence modules](EVIDENCE.md): personal baselines, anomalies, Spearman, exposure comparisons, explicit lags, effect/count reporting, and documented evidence criteria.

Done when planted fixture patterns are recovered under chosen criteria and sparse/constant/missing inputs yield honest outputs; calculations are reproducible without an LLM. No causal inference or model explanation. Depends on Stage 6 and Stage 2 fixtures.

### Stage 8 — Investigation and explanation

Detailed guide: [Stage 8 — Evidence-backed investigation and explanation](stages/stage-08-evidence-investigation.md).

Assemble `EvidenceBundle` via `investigateOutcome()`, add investigate mode, and communicate only supplied facts with limitations. Keep unknown outcomes and inconclusive results explicit.

Done when every numerical claim is traceable to structured evidence and explanations preserve association, sample size, and uncertainty. Missing-factor questioning belongs to Stage 9. Depends on Stages 3–4 and 7.

### Stage 9 — Missing evidence loop

Detailed guide: [Stage 9 — Missing evidence and active sensing](stages/stage-09-missing-evidence-loop.md).

Detect relevant unknowns, rank/select one question deterministically, capture its answer, and rerun investigation. Define tie handling, skipped/unavailable context, and visible before/after state.

Done when the [demo loop](DEMO.md) shows a persisted input and genuine evidence-state update; no stronger label is invented when only current context changed. Depends on Stages 5 and 8.

### Stage 10 — Product UI

Detailed guide: [Stage 10 — Evidence-first product UI](stages/stage-10-evidence-ui.md).

Split into [Stage 10A — Mobile product design](stages/stage-10a-mobile-product-design.md) and [Stage 10B — Mobile UI implementation](stages/stage-10b-mobile-ui-implementation.md). Design may begin earlier using stage contracts and labeled illustrative states; full UI acceptance depends on Stages 5–9. Complete the mobile browser experience before Capacitor. Preserve the Stage 10 umbrella ACs and use sub-stage IDs for detailed review.

Polish Today, Talk, Evidence, and Timeline around investigation. Render provenance, effects/counts, confounders, unknowns, and insufficient-data states. Optimize the demo narrative.

Done when a user can follow unusual observation → question → accepted answer → updated evidence and inspect its origin. UI polish must use the existing evidence contracts. Depends on Stage 9; shell work already belongs to Stage 1.

### Stage 11 — Capacitor integration

Detailed guide: [Stage 11 — Capacitor shell](stages/stage-11-capacitor-shell.md).

Wrap the stable web experience, establish iOS project/runtime permission groundwork, and document shell loading plus hosted backend/native communication. Preserve web health logic.

Done when the existing experience runs in the shell and the source boundary can exchange canonical data. Excludes native analytical implementations and real HealthKit querying. Depends on accepted Stage 10A/10B mobile design and browser implementation, stable web/backend stages and Stage 0 source semantics.

### Stage 12 — Apple Health source

Detailed guide: [Stage 12 — Apple Health source adapter](stages/stage-12-healthkit-adapter.md).

Implement permissions, registry-bounded queries, normalization, provenance/external IDs, and canonical ingestion using `AppleHealthDataSource`.

Done when real samples satisfy the shared contract and reach the existing feature/analytics path without special product branches. Denied/unavailable input remains unknown. Depends on Stage 11 and the established ingestion path.

### Stage 13 — Real-data hardening

Detailed guide: [Stage 13 — Real-data hardening](stages/stage-13-real-data-hardening.md).

Exercise historical team-member data; resolve duplicates, source overlaps, gaps, time zones, partial sessions, device changes, and units. Document source policies; keep native quirks in adapter/normalization.

Done when known real-data cases yield expected normalized/derived outputs and mock fallback still works. Shared domain changes must be explicit rather than hidden HealthKit exceptions. Depends on Stage 12.

### Stage 14 — Personal experiments

Detailed guide: [Stage 14 — Personal experiments](stages/stage-14-personal-experiments.md).

Add experiment contracts/mode and N-of-1 proposals from uncertain predefined relationships. Define primary/secondary outcomes, duration, inclusion criteria, confounders, observations, and descriptive period comparisons.

Done when a proposal can be followed and summarized conservatively without claiming causal proof or medical treatment. The original example is sleep ≥7.5 hours over five training sessions with workout RPE primary and energy/HRV secondary; values remain illustrative. Workout RPE is outside the current registered outcome set, so that example requires an explicit contract/registry extension; begin with a compatible registered plan unless the extension is approved. Depends on the evidence engine and capture/features; ordered after real-data hardening in the original roadmap.

## Reusable umbrella issue scaffold

Use this when creating future issues; it is documentation, not a created GitHub issue:

```markdown
Title: Stage N — [stage name]

Outcome: [observable result from the roadmap]

Context: CONTEXT.md; AGENTS.md; docs/ROADMAP.md#[stage anchor]; [focused reference]

Scope:
- [deliverable or behavior]

Acceptance criteria:
- [observable behavior and relevant failure/uncertainty case]

Dependencies: [contracts, completed stages, or child issues]
Excluded: [adjacent-stage work]
Decisions to resolve: [open choices owned by this stage]
Documentation updates: [canonical documents affected]
```

Stages 1–2 are verified. Stage 3 is implemented with live acceptance pending; see [VOICE](VOICE.md). The Stage 3 acceptance scope should still reference [conversation rules](CONVERSATION.md), [persistence](PERSISTENCE.md), and implemented domain contracts; verify the implemented voice API and secure session transport. Extraction remains Stage 4. Keep this roadmap current as stages are completed; documentation readiness is not evidence that a future feature has shipped.

## Stage 5–6 checkpoint — 2026-10-04

Both stages are implemented with acceptance pending. Stage 5 storage exists in hosted Supabase; Stage 6 migration 007 is applied. Daily projection/read/rebuild, personal/demo scopes and generation invalidation are documented in [DAILY-FEATURES](DAILY-FEATURES.md). Type/lint/build passed; numerical/concurrency/live acceptance is not certified. Stage 7 remains planned and must honor current-generation reads and commits.

Stage 7 checkpoint (2026-10-04): deterministic engine and authenticated Evidence inspector implemented. [ANALYTICS](ANALYTICS.md) defines adopted policies. Numerical/hosted acceptance is pending; the owner deferred manual walkthroughs for delivery. Stage 8 is next.

Stage 8 checkpoint (2026-10-04): owned investigation, validated bundles, approved fact explanations with provider fallback, Evidence controls and voice dispatch implemented. Stage 9 active questioning remains next and is not part of this change.

## Stage 9 delivery checkpoint

Stage 9 is implemented; [ACTIVE-SENSING](ACTIVE-SENSING.md) and the [Stage 9 guide](stages/stage-09-missing-evidence-loop.md) record the runtime policy and manual walkthrough. Stage 10 UI design/implementation remains the next stage.

Stage 10A/B implementation checkpoint (2026-10-04): mobile Talk/Today/Insights/History and voice interview integration are implemented. The owner requested a visual overhaul using design-taste-frontend; [MOBILE-UI](MOBILE-UI.md) records the design and verification. Physical phone/audio and final visual acceptance remain separate. Stage 11 is the next implementation stage; no Capacitor/HealthKit work was added here.

Stage 11–14 checkpoint (2026-10-04): the iOS shell runs on the owner's iPhone against the hosted app with Apple Health connected ([HEALTHKIT](HEALTHKIT.md)); real-data policies and a deidentified case matrix are recorded; `experiments-v1` (sleep ≥ 7.5 h → energy) is implemented with migration 011 pending ([EXPERIMENTS](EXPERIMENTS.md)). Voice-agent behaviour tuning is the next owner priority.
