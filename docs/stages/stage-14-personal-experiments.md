# Stage 14 — Personal experiments

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

A user can opt into a predefined personal observation experiment and receive a descriptive, provenance-backed comparison with honest limitations.

**Dependencies:** Evidence engine and capture/features from [Stages 4](stage-04-structured-observations.md), [6](stage-06-daily-features.md), [7](stage-07-deterministic-analytics.md), [8](stage-08-evidence-investigation.md), and [9](stage-09-missing-evidence-loop.md). Ordered after [Stage 13](stage-13-real-data-hardening.md) in the original roadmap.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [evidence](../EVIDENCE.md), [domain](../DOMAIN.md), [conversation](../CONVERSATION.md), and [demo](../DEMO.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

`experiment` is an existing mode value, but experiment records/storage/controllers/comparison algorithms do not exist. The frozen graph allows energy, HRV, and sleep duration outcomes. Evidence can be uncertain even when a practical observation plan is useful.

## Implementation work

1. Define validated experiment proposal/plan/observation/result records and owner-scoped storage. Include relationship, primary/optional secondary outcome, baseline/intervention periods, duration, eligibility/inclusion/exclusion rules, adherence, confounders, and policy versions. Explicitly review compatibility with version 1 rather than hiding new fields in existing bundles.
2. Generate proposals only for predefined permissible relationships. Application code owns permitted structure, periods, and measurable targets; the model may explain the proposal. Require user acceptance before activating a plan; do not automatically change behavior or prescribe treatment.
3. Define lifecycle and resumption: proposed/planned, active, paused, completed, abandoned, or the explicitly documented equivalent. Store consent/acceptance, dates, edits, and withdrawal semantics; retain traceability when a plan changes.
4. Predeclare eligible observations, minimum coverage, adherence thresholds, comparison method, and interpretation before reviewing intervention results. Collect through existing raw capture/source ingestion and daily features; do not invent trial outcomes.
5. Calculate descriptive baseline/intervention counts, summaries, differences, missingness, and relevant competing factors with deterministic code. Respect graph lags and method/unit meaning. Handle empty groups, zero baseline, partial adherence, changed training/context, and conflicting data as explicit limitations/inconclusive results.
6. Permit the experiment controller to ask only application-selected registered questions. Explain findings conservatively; an unrandomized personal comparison does not establish causation, safety, or treatment efficacy.
7. Render proposal, opt-in, progress, pause/withdraw, and final comparison with raw/derived provenance and synthetic labels. Keep unsupported proposals unavailable until their contracts/relationships are explicitly approved.

## Decisions and constraints

**Important contract gap:** the original illustrative example—sleep ≥7.5 hours for five workouts, with workout RPE primary and energy/HRV secondary—is not executable under the current four-edge graph and outcome allow-list. The numbers were illustrative; workout RPE is not a registered investigation outcome. Initially use a compatible registered plan, or obtain an explicit scope/registry/contract extension before enabling that example. Resolve intervention suitability, plan lifecycle, eligibility/adherence, descriptive method, and version compatibility in this stage.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S14-AC01:** Every offered plan validates against approved experiment contracts and relationship/outcome rules; unsupported RPE-primary examples remain unavailable without an explicit extension.
- **S14-AC02:** The user can inspect/accept a plan, pause/resume or abandon it, and restore progress; no experiment activates without opt-in.
- **S14-AC03:** Eligibility, duration, outcomes, adherence, confounders, and analytical policy are recorded before result interpretation and edits remain traceable.
- **S14-AC04:** Observations use owned canonical raw data/features with provenance; missing/unknown inputs are not fabricated or counted as adherence.
- **S14-AC05:** Descriptive results reproduce declared counts/summaries/differences, handle sparse/zero/partial/confounded cases honestly, and validate with deterministic references.
- **S14-AC06:** Explanations add no unsupported quantities, causal proof, diagnosis, or treatment claim; insufficient experiments remain inconclusive.
- **S14-AC07:** Experiment storage/tools are owner-scoped, browser users cannot forge derived results, and question/mode permissions are enforced in code.
- **S14-AC08:** A compatible synthetic demonstration completes proposal→acceptance→observations→comparison while clearly labeling fictional data and limitations.

## Verification and completion record

Test lifecycle/ownership/replay, compatibility rejection, predeclared-policy preservation, sparse/zero/partial-adherence histories, changed confounders, and deterministic comparison references. Demonstrate a compatible full plan and an inconclusive/abandoned plan. No clinical-trial or causal-validity claim follows from these checks.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Medical treatment trials, automatic interventions, unrestricted outcome discovery, silent graph extension, randomized causal inference, and clinician workflow implementation (`doctor_prep` remains a separate future scope).

## Documentation handoff

Update DOMAIN with approved experiment models/compatibility, PERSISTENCE with tables/policies, EVIDENCE with predeclared descriptive comparisons, CONVERSATION with experiment controller permissions, and DEMO with an approved executable example.
