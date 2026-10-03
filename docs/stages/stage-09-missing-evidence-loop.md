# Stage 9 — Missing evidence and active sensing

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

The app detects missing relevant context, asks one chosen question, captures the answer, and recomputes a truthful before/after evidence state.

**Dependencies:** [Stage 5](stage-05-deterministic-check-ins.md) controller patterns and [Stage 8](stage-08-evidence-investigation.md) bundles, using extraction/features/analytics from Stages 4, 6, 7.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [conversation](../CONVERSATION.md), [evidence](../EVIDENCE.md), [domain](../DOMAIN.md), and [demo](../DEMO.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Investigation supplies dated unknown factor/context references. Extraction supplies validated accepted events. Feature/result freshness is established in Stages 6–8. No question-ranking or before/after orchestration exists yet.

## Implementation work

1. Enumerate candidates only from registered relationships/confounders and validated unknown feature/date references. Preserve each factor’s lag. An unavailable wearable measurement is not automatically a question the user can answer.
2. Specify a deterministic `selectBestQuestion()` policy: answerability, relevance, coverage/priority, skipped/unavailable exclusions, and stable tie breaking. Record policy version and termination/no-question conditions. Do not ask a model to rank health factors.
3. Persist or otherwise reliably restore the selected question’s outcome/date/feature context. Ask one question at a time, with explicit temporal anchors and appropriate rating/boolean semantics. The model may phrase it but cannot change its target.
4. Route the answer through Stage 4 with the source turn and selected date context. Explicit false is a known report; skipped/ambiguous/failed input remains unknown. Do not assume the selected question overrides what the user actually reports.
5. Rebuild the affected day and refresh dependent analyses/bundle through the established invalidation path. Respect factor/confounder lags and compatible versions. Await confirmed persistence before announcing updated evidence.
6. Show before/after facts and limitations. One current-context answer may clarify today without strengthening historical evidence; comparison must reflect actual computed changes, including no change.
7. Prevent repeated questions on reconnect/replay and terminate when resolved, skipped, unavailable, or no useful allowed candidate remains. Offer user stop/skip without coercion.

## Decisions and constraints

Resolve rank/tie policy, question lifetime, skip persistence, answerability mapping, and recomputation orchestration. No new variables/edges may be introduced to manufacture a better follow-up. Unknown context cannot be filled with synthetic latent values or model guesses.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S09-AC01:** Identical bundle/controller state and policy version select the same allowed dated question or no-question result.
- **S09-AC02:** Known, skipped, unavailable, irrelevant, and unanswerable references follow the documented exclusion policy; lags/time anchors are correct.
- **S09-AC03:** Only one selected question is active; model phrasing cannot alter its dimension/date or invoke an unauthorized tool.
- **S09-AC04:** A confirmed accepted answer preserves turn provenance and updates the intended raw/derived context; negative answers remain known false.
- **S09-AC05:** Failed/ambiguous/skipped answers do not fabricate a value or a successful recomputation; retries/reconnects do not duplicate events or resolved questions.
- **S09-AC06:** Before/after evidence comes from fresh validated generations and changes only where actual data/calculations changed; unchanged historical strength is shown honestly.
- **S09-AC07:** The demo completes detect→investigate→ask→persist→recompute, and can also terminate truthfully when no eligible question remains.

## Verification and completion record

Test ranking ties, known negatives, every lag/date mapping, no-candidate cases, skips, reconnect, extraction failure, rebuild failure, and a context-only change that leaves historical strength unchanged. Run a complete live demo from an explicitly anchored fixture history and record before/after bundles.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Arbitrary interviewer topics, model-created causal hypotheses, diagnoses, and stronger evidence labels without new qualifying calculations.

## Documentation handoff

Update CONVERSATION with selection/controller rules, EVIDENCE with recomputation semantics, DEMO with exact reproducible loop steps, and PERSISTENCE if question state is stored.
