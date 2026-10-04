# Stage 10 — Evidence-first product UI

## Status and intended outcome

**Stage 10A/B implemented together, 2026-10-04. Automated/browser verification is recorded below; owner visual and physical audio acceptance remains pending.**

A user can follow an unusual observation through a question and accepted answer to updated evidence, and inspect its origin and uncertainty.

**Dependencies:** [Stage 9](stage-09-missing-evidence-loop.md) for the complete functional journey; existing shell from Stage 1. Design can start earlier under Stage 10A.

## Sub-stages and sequence

- [Stage 10A — Mobile product design](stage-10a-mobile-product-design.md): screen hierarchy, navigation, annotated layouts, state/action specification and design review. Produces `docs/MOBILE-UI.md` when executed.
- [Stage 10B — Implement the mobile product UI](stage-10b-mobile-ui-implementation.md): shared mobile shell/components, actual controller integration, accessibility and phone browser acceptance.
- Complete the mobile web experience before [Stage 11 — Capacitor](stage-11-capacitor-shell.md). Native runtime behavior remains Stage 11 work.

This guide retains umbrella scope and stable `S10-AC` IDs. Sub-stage guides own detailed work and `S10A-AC`/`S10B-AC` criteria. Stage 10 completion requires the reviewed design, Stage 10B acceptance and the umbrella criteria below. Early design or fixture-backed scaffolding does not certify the evidence loop.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [demo](../DEMO.md), [evidence](../EVIDENCE.md), [domain](../DOMAIN.md), and [fixtures](../FIXTURES.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Today/Talk/Evidence/Timeline already have navigation and basic sample history/transcript foundations. For full integration, earlier stages must supply validated features, calculations, investigation, and questions. This stage completes how those facts are displayed, rather than calculating a second version in components.

## Implementation work

1. Design Today around current observations, baseline/anomaly context when eligible, relevant unknowns, and the selected next question. Do not turn the product into an unexplained readiness number.
2. Present Evidence with relationship definition, dates/lag, method-specific effect and units, actual usable counts/groups, label, period, and competing-factor limitations. Separate insufficient history from an evaluated absence of meaningful signal.
3. Make Timeline distinguish raw wearable samples, voice observations, and derived summaries. Show source/time zone/occurrence versus capture semantics and links to owned provenance. Preserve synthetic labels throughout the evidence flow.
4. Make Talk expose session/transcript and captured/clarification/failed-save states with clear microphone controls. Connect selected questions/investigations to their real controller state.
5. Reuse server/domain outputs for values and labels; formatting must not create statistics or drop meaningful signs/units. Show freshness/version/error states where material. Provide understandable loading, empty, unknown, unavailable, and failure views.
6. Optimize narrow mobile layouts, keyboard navigation, focus, readable contrast, accessible control names, and audio alternatives through visible transcript. Keep implementation internals out of normal user flows.
7. Document and rehearse one complete fixture demo plus honest insufficient-data and failed-provider paths. Keep setup/reset actions separated from evidence claims and avoid misleading real-data labeling.

## Decisions and constraints

Resolve screen hierarchy and formatting with actual bundle examples. UI may round numbers for readability, but inspectable evidence must retain the underlying value/count meaning. Provenance inspection must be owner-scoped. No parallel frontend analytics or synthetic clinical claims.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S10-AC01:** Today→question→Talk answer→updated Evidence works from the documented fixture setup without manual hidden data edits.
- **S10-AC02:** Every displayed value/effect/count/label is traceable to validated raw or derived data; units, lag, period, and uncertainty remain visible where needed.
- **S10-AC03:** Users can inspect owned source/turn provenance and distinguish synthetic versus real, raw versus derived, unknown versus explicit negative.
- **S10-AC04:** Insufficient history, no meaningful signal, unavailable data, loading, stale/recomputing, and errors have truthful distinct states.
- **S10-AC05:** Voice/extraction/save failures are visible; the UI does not announce saved answers or updated evidence before confirmation.
- **S10-AC06:** Core flows work on the documented narrow mobile viewport and with keyboard navigation; microphone actions have clear accessible names and transcript feedback.
- **S10-AC07:** No readiness score, unsupported causal statement, or independently recalculated frontend evidence is introduced.

## Verification and completion record

Review screenshots at desktop and narrow mobile sizes, inspect representative rendered values against bundles, exercise keyboard/focus behavior, and rehearse complete/sparse/error demo paths. Record screenshots and browser versions when verifying implementation; docs alone do not establish visual completion.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

New analytics, new domain variables/relationships, native shell, real HealthKit ingestion, and experimentation UI beyond existing scope.

## Documentation handoff

Update DEMO with the rehearsed path and expected evidence, CONVERSATION for visible control/state semantics, and relevant canonical docs if product decisions changed.

## Stage 10 implementation checkpoint — 2026-10-04

The owner authorized Stage 10A and 10B together after reviewing the voice-first direction. [MOBILE-UI](../MOBILE-UI.md) specifies the implemented navigation, layouts, data mapping, states, tokens and native handoff. Product names are Talk, Today, Insights and History; existing URLs remain compatible. No normal health-answer text form is required. Voice integration repairs explicitly address missing morning question context, global investigation interception and overlong spoken evidence.

Implementation: mobile shell and primary microphone; committed latest-turn feedback and secondary transcripts; real daily/analytical views with labeled source selection and energy history; readable raw history and source filters; explicit server-validated voice interview context; spoken morning answers/uncertainty/skips; concise fact-selected investigations; durable investigation recovery. No database migration or native package added.

Acceptance is split: implemented source/contracts and automated/static checks are recorded in MOBILE-UI; visual review and physical phone/audio approval are separate. Do not infer microphone or Capacitor acceptance from a build. The dev check-in window/reset are preserved.


## Owner acceptance — 2026-10-04

The project owner marked Stage 10 (including 10A and 10B) done so Stage 11–12 can proceed. Known open items are accepted, not passed: voice-agent reliability (owner will fix after the presentation base), real-device microphone walkthrough, populated-account journey rehearsal; the light-theme muted-label contrast gap (4.44:1) was later closed by raising muted text to 72% opacity. The daisyUI “Grove” theme and browser measurements are recorded in [MOBILE-UI](../MOBILE-UI.md).
