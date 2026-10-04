# Stage 9 — Missing evidence and active sensing

## Status and intended outcome

**Implemented (2026-10-04). Automatic verification is recorded below; physical voice and visual acceptance remain manual.**

The app detects missing relevant context, asks one chosen question, captures the answer, and recomputes a truthful before/after evidence state.

**Dependencies:** [Stage 5](stage-05-deterministic-check-ins.md) controller patterns and [Stage 8](stage-08-evidence-investigation.md) bundles, using extraction/features/analytics from Stages 4, 6, 7.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [conversation](../CONVERSATION.md), [evidence](../EVIDENCE.md), [domain](../DOMAIN.md), and [demo](../DEMO.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Investigation supplies dated unknown factor/context references. Extraction supplies validated accepted events. Feature/result freshness is established in Stages 6–8. Question ranking, durable single-question state, canonical answer capture and before/after orchestration now live in `lib/questions/`. [ACTIVE-SENSING](../ACTIVE-SENSING.md) owns the exact implemented policy and recovery boundary.

## Implementation work

1. Enumerate candidates only from registered relationships/confounders and validated unknown feature/date references. Preserve each factor’s lag. An unavailable wearable measurement is not automatically a question the user can answer.
2. Specify a deterministic `selectBestQuestion()` policy: answerability, relevance, coverage/priority, skipped/unavailable exclusions, and stable tie breaking. Record policy version and termination/no-question conditions. Do not ask a model to rank health factors.
3. Persist or otherwise reliably restore the selected question’s outcome/date/feature context. Ask one question at a time, with explicit temporal anchors and appropriate rating/boolean semantics. The model may phrase it but cannot change its target.
4. Route the answer through Stage 4 with the source turn and selected date context. Explicit false is a known report; skipped/ambiguous/failed input remains unknown. Do not assume the selected question overrides what the user actually reports.
5. Rebuild the affected day and refresh dependent analyses/bundle through the established invalidation path. Respect factor/confounder lags and compatible versions. Await confirmed persistence before announcing updated evidence.
6. Show before/after facts and limitations. One current-context answer may clarify today without strengthening historical evidence; comparison must reflect actual computed changes, including no change.
7. Prevent repeated questions on reconnect/replay and terminate when resolved, skipped, unavailable, or no useful allowed candidate remains. Offer user stop/skip without coercion.

## Decisions and constraints

Implemented choices are documented in [ACTIVE-SENSING](../ACTIVE-SENSING.md): `questions-v1`, owner-level durable state, explicit skip/stop, dated subjective-only answers, private atomic persistence and generation-checked recomputation. No new variables/edges may be introduced to manufacture a better follow-up. Unknown context cannot be filled with synthetic latent values or model guesses.

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

## Completion record — 2026-10-04

- Application code selects one allowed dated question and preserves it across reconnects; Evidence and Talk can submit canonical answers. Personal and simulated demo answers remain separate.
- Hosted migration 010 is applied; browser writes are denied and full history reset removes question state.
- 81 unit tests, production build, lint, type check, whitespace and documentation-link checks passed. Hosted/provider checks passed canonical negatives, exact dates, scope isolation, ownership, restoration, skips/stops/termination, simulated failure recovery, lost voice receipt protection, explicit-date precedence, rating ambiguity and concurrent revision guards. Stage 8 regression checks passed after the voice changes. The final handoff records the last live run.
- Physical speech/audio rendering and functional UI acceptance remain manual; automatic typed voice dispatch does not certify microphone recognition. Interrupted-refresh/failed-answer recovery checks simulate persisted interruption states, not every real service outage.

### Acceptance validation before Stage 10

This is a functional validation path for Stage 9, not a recording script or mobile design review. Stage 10 owns the actual mobile UI. Use a separate private demo session if you need empty history; keep existing personal records intact.

| Check | Steps | Required result |
| --- | --- | --- |
| S09-AC01/02: selection and lag | In an empty personal session investigate HRV for today. Note the selected question and date. Refresh and reload. | One alcohol question for yesterday; identical unmodified state selects the same target. Unknown HRV remains explicitly unknown. No invented outcome or cause. |
| S09-AC03/04: negative answer | Answer **No.** to the alcohol question. Inspect Timeline and the refreshed dated context. | One raw alcohol report, correct selected local date and source turn, `consumed:false` and daily exposure false. The question advances or ends. |
| S09-AC05: replay | Reload, refresh evidence and retry the same saved voice turn if its receipt needed recovery. Count matching raw reports. | No additional event or reapplication to the next question; the completed question does not return. |
| S09-AC04/05: rating ambiguity | Investigate sleep duration on an unfilled day; its stress factor refers to the previous day. Answer **I was very stressed.** Then restate **My stress was six out of ten on [the displayed date].** | First answer requests an explicit rating and saves no guessed number. Complete answer saves 6 on the displayed date. For a workout question, **I did not train.** never becomes RPE 0. |
| S09-AC04: explicit date precedence | With a rating question active, report that rating for a different explicit past date. Inspect both dates. | The reported date is preserved; the selected date remains unknown and its question remains open. Nothing is rewritten to fit the selected target. |
| S09-AC05/07: uncertainty, skip, stop | Answer **I don't know.**; inspect raw data. Skip the question, reload, then stop and reload again. | No health event from uncertainty/skip/stop. The skipped dated target is excluded on resumption. Stopped state has no active question. Starting the same input explicitly resumes it while retaining exclusions. |
| S09-AC03: command during a question | In Talk, with a question active, say **Investigate the synthetic demo HRV for September twentieth, 2026.** | A new HRV investigation uses exactly 2026-09-20 and demo scope. The command is not interpreted as an answer to the old question. |
| S09-AC04/06: real speech dispatch | In Talk request **Investigate my HRV today.** Answer its question naturally, including a short **No.** when appropriate. Inspect the recognized transcript and Timeline. | The original spoken user turn is the event provenance. Feedback confirms actual persistence and refreshed evidence. English question wording is expected in the current UI. |
| S09-AC05/06: failure recovery | Interrupt the connection during an answer, restore it and reload Evidence. Recover its original pending ID/text, or refresh a confirmed-but-stale result. An in-flight lease may require up to 90 seconds before retry/skip. | The UI distinguishes pending, captured-needing-refresh and fresh. No fabricated successful capture/calculation, duplicate report, changed pending text or answer applied to a different question. |
| S09-AC06: stale inputs | Record another observation or change the profile time zone while a question is open. Return to Evidence. | Stale state is labeled; answering it is refused. Refresh after raw changes. Stop the old question and start a new investigation after a zone change. |
| S09-AC06/07: populated before/after | Load default samples in a fresh session. Select HRV / **2026-09-20** / Synthetic demonstration and ask about missing context. The alcohol gap is **2026-09-19**. Answer **No.** and inspect before/after. | Alcohol changes unknown→known false, with a new generation. Historical association counts/effects/strength remain unchanged for this current-context answer; no causal conclusion is added. Personal scope excludes the simulated answer. |
| S09-AC07: exhaustion | Skip remaining eligible questions until no candidate remains; reload or restart the identical investigation. | Truthful termination. Known/skipped/answered/unavailable/ambiguous inputs stay excluded. It never asks for an estimated wearable value or invents another topic. |

If any check fails, record the exact recognized transcript, displayed target/date/scope, response status and expected/actual raw event. Avoid pasting keys or session tokens. A failed capture/persistence/replay or evidence-accuracy check requires repair before treating Stage 9 as accepted. Visual polish belongs to Stage 10; functional failures do not.
