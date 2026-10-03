# Stage 10B — Implement the mobile product UI

## Status and intended outcome

**Planned; specified 2026-10-04. This guide is an implementation specification.**

Implement the accepted Stage 10A design in the existing Next.js application. A person can use the complete evidence journey in a phone browser, inspect and correct observations, and understand uncertainty and failures. The resulting mobile web app is ready for Capacitor packaging.

This is the implementation sub-stage of [Stage 10](stage-10-evidence-ui.md). Preserve its existing `S10-AC01`–`S10-AC07` umbrella criteria; new implementation criteria use `S10B-AC` IDs. Completion requires both sets.

**Dependencies:** reviewed [Stage 10A](stage-10a-mobile-product-design.md) specification; Stage 1 shell/auth; working voice/capture contracts from Stages 3–4.5; Stage 5 for check-ins and Stages 6–9 for the complete analytical/question loop. Design and explicitly authorized UI scaffolding can progress earlier with labeled fixtures, but full Stage 10B acceptance requires real integration. [Stage 11](stage-11-capacitor-shell.md) follows the accepted mobile browser experience.

## Context to read and baseline

Read [AGENTS](../../AGENTS.md), [CONTEXT](../../CONTEXT.md), [Stage 10](stage-10-evidence-ui.md), the Stage 10A outputs (`docs/MOBILE-UI.md` once created), [ARCHITECTURE](../ARCHITECTURE.md), [DEMO](../DEMO.md), [DOMAIN](../DOMAIN.md), [EVIDENCE](../EVIDENCE.md), [VOICE](../VOICE.md), [CAPTURE](../CAPTURE.md) and [PERSISTENCE](../PERSISTENCE.md).

Inspect current routes, session provider, styles, capture/retrieval components and controller outputs before replacing layouts. Preserve existing Next.js + Supabase, anonymous session restoration, owner checks, transcript recovery, correction/replay and missing-credential behavior. Read the installed Next.js guidance required by AGENTS before application changes.

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Components render validated facts and controller-selected questions. Formatting may round for display but must preserve meaning, signs, units, counts and inspectable underlying values. No frontend analytical implementation or invented fallback evidence.

## Implementation work

1. **Shared mobile shell:** implement the agreed navigation, page hierarchy, responsive containers and active destination state. Respect safe-area CSS insets, phone browser viewport changes, keyboard and scroll behavior. Keep the current desktop experience usable. No Capacitor dependency is needed for this work.
2. **Components and styling:** implement agreed tokens and reusable observation, question, evidence, source, state and action components. Reuse existing conventions where practical; introduce a UI dependency only with a concrete need. Provide readable focus states, contrast, accessible names, at least 44 × 44 CSS-pixel touch targets and reduced-motion behavior where motion exists.
3. **Today:** render validated observations and eligible anomalies with one selected next action, relevant missing context and freshness. Link to the owning investigation/question. Empty/sparse users receive an honest path to recording or labeled sample history, without fabricated comparisons.
4. **Talk:** make the agreed voice controls and listening/transcribing/processing/speaking/muted/disconnected states prominent. Surface confirmed observations and selected clarification/correction directly; make transcripts/provenance accessible as secondary detail. Preserve press-to-speak pointer/keyboard cancellation, explicit correction targets, typed recovery, confirmed feedback and stale-response suppression.
5. **Evidence:** render the actual bundle and relationship results: local dates/lag, period, method, effect/units, usable pairs or group counts, label, competing factors and limitations. A confirmed answer may update current context without strengthening historical evidence; display the actual recomputation result. Keep insufficient history separate from no meaningful signal.
6. **Timeline:** present owned wearable samples, accepted voice reports and derived summaries distinctly. Expose source and local-date semantics, unknown quantities and explicit negatives; link to owned provenance and supported correction. Reveal browsing caps and incomplete histories; a finite list is not a complete analytics query.
7. **State and resilience:** implement the Stage 10A state/action table against actual requests. Preserve prior confirmed data during refresh/correction failure with a stale/error indication. Prevent duplicate submissions, make retries explicit and never mark a report saved or evidence updated before confirmation. Show connectivity failure truthfully; do not imply an offline capture queue or background sync exists.
8. **Integration and rehearsal:** connect the Today → Talk → Evidence journey to the existing deterministic controllers and persistence, then rehearse the complete, sparse and failed scenarios. Keep fixtures labeled and isolated from real production state. Document mobile browser results and the remaining native-specific work for Stage 11.

## Decisions and constraints

Use the approved design as the reference. Record implementation-driven deviations in `docs/MOBILE-UI.md`; product hierarchy or meaning changes require design review. Keep domain/schema validation out of presentation-only helpers. Any view-model adapter must map existing values without recomputing evidence or supplying missing values.

Support loading/unavailable placeholders for unfinished APIs during explicitly authorized early scaffolding. Record which integrations remain missing; placeholders do not satisfy functional ACs. Do not add migrations, HealthKit plugins, native audio work or a new authentication mechanism to solve layout problems.

## Acceptance criteria

All criteria remain pending until supported by recorded checks.

- **S10B-AC01 — Accepted design:** Today, Talk, Evidence and Timeline follow the Stage 10A navigation/layout/state specification. Meaningful deviations and their review are recorded; desktop navigation remains usable.
- **S10B-AC02 — Phone layout:** At 320, 375, 390 and 430 CSS-pixel widths, core actions and content remain usable without accidental horizontal overflow or clipped controls. Long text, landscape, browser viewport changes, safe-area layouts and the open keyboard do not cover required actions. Record actual device/browser checks separately from viewport emulation.
- **S10B-AC03 — Accessible interaction:** Core journeys work with keyboard and visible focus; controls have accessible names and adequate touch targets. Status/errors are available in text and appropriate live announcements, with no color-only meaning. Contrast meets WCAG AA thresholds (4.5:1 normal text, 3:1 large text and relevant interface boundaries); audio has a visible text alternative.
- **S10B-AC04 — Real journey:** From the documented fixture setup, Today selects a real missing-context question, Talk confirms the answer, and Evidence displays the actual recomputed bundle without hidden data edits or simulated success.
- **S10B-AC05 — Grounded rendering:** Representative screen values match their validated source outputs. Units/signs, evaluated period, eligible counts/groups, lag, source, limitations and completeness remain correct and inspectable; no frontend evidence calculations or readiness score exist.
- **S10B-AC06 — Voice and correction:** Deliberate recording, transcript/save distinction, clarification selection, confirmed capture, retrieval and correction remain usable on the tested phone browser. No duplicate captures, unrelated-target changes or late replies arise in the recorded interruption/navigation cases. Unverified browser audio support is labeled rather than assumed.
- **S10B-AC07 — Failure states:** Empty, unknown, explicit negative, insufficient history, no meaningful signal, loading, stale/recomputing, offline/unavailable and provider/save failures render distinct truthful states with appropriate retry/cancel actions. Failed correction retains prior accepted observations; stale evidence is not presented as recomputed.
- **S10B-AC08 — Ownership and provenance:** Source/turn inspection and corrections remain owner-scoped. Synthetic data is visibly labeled across the whole journey; raw and derived records remain distinct. Browser session restoration and missing-credential rendering retain existing behavior.
- **S10B-AC09 — Browser demo:** Record screenshots and a complete phone browser walkthrough, plus sparse and failure paths, with viewport/device/browser details. Record microphone walkthrough and actual latency separately; passing build or desktop checks does not certify physical audio.
- **S10B-AC10 — Capacitor handoff:** Stage 10 umbrella ACs and the implemented screen/state checklist have completion evidence. Document known limitations, routes/backend requirements, auth assumptions and outstanding native safe-area/keyboard/back/audio/lifecycle checks. Stage 11 packages this experience instead of redesigning it.

## Verification and completion record

When implementation verification is authorized, run the relevant project checks and browser interaction checks. Compare representative renders to actual validated payloads; exercise keyboard/focus, long content, narrow layouts, retries, refresh and owner isolation. Rehearse the fixture journey without substituting hard-coded evidence. Record emulation, physical browser and microphone results separately; no claim of iOS WebView support before Stage 11.

At completion record date/revision, screenshots, device/browser matrix, checks actually performed and unresolved limits here. Update `docs/MOBILE-UI.md` for implemented behavior, DEMO for setup/rehearsal, the Stage 10 umbrella and index for acceptance, and VOICE/CONVERSATION only where interaction semantics changed.

## Exclusions and handoff

No new analytics, relationship definitions, question-selection algorithms, native shell, HealthKit ingestion, offline synchronization, experiments, App Store release or authentication redesign. Integration defects belong to their owning stages and must be resolved explicitly rather than hidden in UI fallbacks.

Next: [Stage 11 — Capacitor shell](stage-11-capacitor-shell.md). CSS-safe-area preparation and mobile browser success do not establish native keyboard, permission, background/foreground or microphone behavior.
