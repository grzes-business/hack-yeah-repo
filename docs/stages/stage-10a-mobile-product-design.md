# Stage 10A — Mobile product design

## Status and intended outcome

**Planned; specified 2026-10-04. Documentation does not authorize UI implementation.**

Define a coherent phone experience for the voice-first Personal Health Evidence Engine: what is happening, what is known, and what useful question or action comes next. Produce concrete screen and interaction specifications that Stage 10B can implement without inventing the product.

This is the design sub-stage of [Stage 10](stage-10-evidence-ui.md). Stage numbers 11–14 and existing `S10-AC` IDs remain unchanged. New criteria use `S10A-AC` IDs.

**Dependencies:** product/domain contracts and existing Stage 1 shell. Design can start before Stages 5–9 finish, using their stage specifications and clearly labeled illustrative states. Full evidence integration remains dependent on those stages; a design artifact does not certify their behavior. Stage 10A precedes [Stage 10B](stage-10b-mobile-ui-implementation.md), which precedes [Capacitor](stage-11-capacitor-shell.md).

## Context to read and baseline

Read [AGENTS](../../AGENTS.md), [CONTEXT](../../CONTEXT.md), the [stage index](README.md), [DEMO](../DEMO.md), [DOMAIN](../DOMAIN.md), [EVIDENCE](../EVIDENCE.md), [CONVERSATION](../CONVERSATION.md), [VOICE](../VOICE.md), and [Stage 9](stage-09-missing-evidence-loop.md).

Inspect the existing Today, Talk, Evidence and Timeline routes, session flow, capture cards and source labels. Reuse their actual capabilities and ownership boundaries. Record which interactions already work and which require future controllers. Do not presume that a placeholder Evidence screen means investigation exists.

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. No composite readiness score, guessed health value, inferred dose, causal diagnosis or new tracked variable. Missing reports remain unknown; explicit negatives and synthetic observations remain distinguishable.

## Design deliverables

Create `docs/MOBILE-UI.md` during this stage as the canonical implementation specification, linked from AGENTS and DEMO. Keep stage work and ACs here; keep concrete design decisions in that specification. Supporting wireframes/prototypes may live under `docs/design/mobile/`, with links and a readable description so continuation does not depend on an external tool or chat history.

The specification must include:

- Screen hierarchy, navigation map and the complete Today → Talk → Evidence journey.
- Annotated phone layouts, content priority and tap behavior for the four core screens.
- A state/action table naming the owning controller or validated data source, confirmation boundary and recovery action.
- Shared component inventory and initial visual tokens: typography, spacing, colors, surfaces, icons, touch targets and motion.
- Responsive, accessibility, keyboard, safe-area and scroll rules for Stage 10B.
- Representative complete, sparse, unknown and failed scenarios, with synthetic/illustrative content labeled.
- Explicit unresolved decisions and unavailable functionality rather than an implied backend implementation.

## Screen and interaction scope

| Screen | Primary job | Required inspectable detail |
| --- | --- | --- |
| Today | Show a small number of relevant changes and one useful next action | Observation/date/unit, eligible comparison, missing context, evidence freshness, source and insufficient-history state. |
| Talk | Make deliberate voice input and its result understandable | Microphone/listening/transcribing/processing/speaking states, committed observations, one clarification, selected correction target, retry and cancellation. Transcript is available as secondary detail. |
| Evidence | Explain a finding and its limits | Registered relationship, factor/outcome dates and lag, evaluated period, method-specific effect/units, usable counts/groups, evidence label, competing factors and provenance. |
| Timeline | Let the user inspect recorded history and correct a report | Local dates, source, raw versus derived records, unknown quantities, explicit negatives, original turn and accepted correction state. |

Include the existing anonymous demo entry and profile/time-zone controls without designing a new authentication system. Keep sample load/reset and diagnostic controls accessible but subordinate to the user journey. Experiments and HealthKit permissions belong to their later stages.

## Work breakdown

1. Audit current screens and document a capability matrix: implemented, future, unavailable. Identify state contracts from the owning stage instead of designing independent calculations.
2. Map a first visit, repeat visit, quick report, selected clarification/correction and saved-report lookup. Specify how Today passes an application-selected question to Talk and how a confirmed answer returns to an updated investigation.
3. Decide navigation and hierarchy. Evaluate a persistent four-destination phone navigation; record the chosen pattern, selected state, back behavior and preservation of active voice state. Decide whether Talk uses a full screen or another layout; do not leave conflicting alternatives for implementers.
4. Design annotated layouts with realistic content lengths. Start with Today → Talk → Evidence, then Timeline and provenance/correction detail. Keep the voice control prominent and transcripts secondary without hiding save failure or accepted values.
5. Specify state and recovery behavior. Distinguish empty account, missing input, insufficient history, evaluated no meaningful signal, loading, stale/recomputing, permission denial, provider/save failure, disconnection and offline/unavailable requests. Never show saved or recomputed success before acknowledgement.
6. Define visual tokens and shared components. Use consistent language and a calm readable hierarchy; show uncertainty in text as well as color. Include visible text alternatives to audio, accessible names and focus order.
7. Review the complete fixture story and the sparse/error alternatives. Resolve product choices with the owner before calling the specification ready; document accepted decisions and remaining limitations.

## Acceptance criteria

All criteria remain pending until supported by reviewed artifacts.

- **S10A-AC01 — Journey:** A linked navigation map and annotated layouts cover entry → Today → selected question → Talk → accepted answer → updated Evidence, plus Timeline inspection and report correction.
- **S10A-AC02 — Screen specification:** Each core screen has a clear primary action, content order, detail access, navigation behavior and realistic phone layout. Talk does not require reading the entire transcript to understand recording or save status.
- **S10A-AC03 — Data mapping:** Every proposed value, label, question and mutation names its canonical source/controller. Planned integrations are labeled; illustrative numbers are not presented as calculated personal evidence.
- **S10A-AC04 — State coverage:** The specification separately describes loading, empty, unknown, explicit negative, insufficient history, no meaningful signal, stale/recomputing, offline, permission/provider/save failure and recovery. Audio and visible confirmation share the same committed state.
- **S10A-AC05 — Mobile and accessibility:** Layout rules cover 320–430 CSS-pixel phone widths, larger screens, safe-area insets, open keyboard, long text and scrolling. Interactive targets are at least 44 × 44 CSS pixels; keyboard/focus, contrast and non-color state cues are specified.
- **S10A-AC06 — Evidence honesty:** Effect units, period, usable counts, lag, competing factors and source remain inspectable. Raw/derived, synthetic/real and unknown/negative distinctions survive the journey; no readiness score or unsupported causal claim appears.
- **S10A-AC07 — Handoff:** `docs/MOBILE-UI.md` and linked artifacts contain the chosen navigation, component/token inventory, state/action table, integration dependencies and open decisions. An agent can implement from these files without conversation history.
- **S10A-AC08 — Review:** Record the owner's design review, agreed revisions and remaining decisions. A reviewed design does not count as passing browser, voice, evidence-engine or native acceptance.

## Verification and completion record

Review artifacts against actual contracts and representative scenario payloads. Walk through the success, insufficient-data and failure stories using wireframes or a design prototype; record gaps and decisions. A prototype must identify any simulated state or response. No application tests, provider calls or migration changes are necessary merely to write the design specification.

At completion record date, artifact paths, reviewed scenarios, decisions and remaining limitations here. Update the stage index and Stage 10 umbrella. Keep owner acceptance distinct from implemented and verified behavior.

## Exclusions and handoff

No production UI code, new backend/analytics, auth redesign, Capacitor project, HealthKit integration or experiment interface. Stage 10B implements the accepted design in the existing Next.js app. Stage 11 owns actual WebView lifecycle, native navigation, permission and audio compatibility; these cannot be certified by wireframes.
