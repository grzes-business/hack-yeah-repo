# Stage 4 — Canonical structured observations

## Status and intended outcome

**Implemented on 2026-10-03; partial verification recorded below, full acceptance pending.**

See [capture implementation](../CAPTURE.md). Hosted migrations 003 and 004 are applied. Initial types/lint/build checks passed. Subsequent capture diagnosis and the audit below verified selected deterministic, hosted, and live-provider paths. No criterion is certified in full until its remaining live/UI cases are checked.

Finalized user speech creates only validated predefined observations, with auditable turn provenance and accurate capture/clarification feedback.

**Dependencies:** [Stage 3](stage-03-live-voice.md), using Stage 0 schemas and Stage 1 ownership/persistence.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [conversation](../CONVERSATION.md), [domain](../DOMAIN.md), and [persistence](../PERSISTENCE.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Final user turns exist from Stage 3, whose live voice was confirmed by the user. `lib/domain/events.ts` already defines draft and canonical extraction schemas. Subjective event persistence and turn references already exist. Stage 2 subjective fixtures are reference inputs, not a replacement for live extraction.

## Implementation work

1. Trigger extraction from a finalized persisted user turn. Read it under verified ownership; do not trust an arbitrary caller-supplied transcript/turn ID as evidence of ownership. Keep extraction execution separate from voice transport and persistence.
2. Give the extractor the allowed event vocabulary, explicit rating anchors, temporal context, and draft output schema. Parse the returned discriminated outcome before accepting anything. Unknown speech returns nothing trackable; unresolved required meaning returns clarification.
3. Preserve version 1 all-or-clarify: multiple clear observations may be captured together, but an ambiguous extraction must not silently save a partial subset. Unknown quantities allowed by the schema can remain null; do not force an invented number to avoid clarification.
4. Application code resolves relative dates in the user’s IANA zone, assigns stable accepted IDs/capture timestamp/time zone/turn provenance, and validates canonical records. Associate workouts only with verified relevant sessions; never let the model forge session or ownership fields.
5. Define idempotent processing per source turn and extraction version. Stable event ordinals/IDs must survive retries; track processing outcome if needed with an explicit storage design. Avoid duplicate writes when provider callbacks/reloads replay.
6. Persist validated events and display exactly what was confirmed. Distinguish pending, saved, nothing trackable, clarification required, and failed. Clarification/correction links must preserve the originating turn rather than rewriting history invisibly.
7. Handle provider/schema failures and storage partial failures with retry and honest status. Changing an accepted observation must have documented replacement/supersession semantics before later feature builders depend on it.

## Decisions and constraints

Settled: 0–10 scales; model drafts omit canonical provenance; all-or-clarify. Implemented decisions are documented in CAPTURE: frozen original-day/time-zone anchors, representative noon for past date-only reports, explicit DST clarification, capture-v1 leased replay bookkeeping, atomic saves, and explicit typed correction with revision history. “My knee hurts” can express pain with unknown intensity; it does not authorize a diagnosis. Do not infer caffeine mg or alcohol standard drinks from unspecified language.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S04-AC01:** Clear single/multiple known observations yield schema-valid canonical events linked to the owned finalized user turn.
- **S04-AC02:** Unknown concepts do not create new event keys; ambiguous required meaning produces a clarification outcome and no silently accepted partial subset.
- **S04-AC03:** Allowed unknown quantities remain unknown; explicit zero/false reports retain their distinct semantics and rating anchors/bounds are enforced.
- **S04-AC04:** Relative dates resolve using the user’s zone, including midnight/DST cases; unclear timing is clarified under the documented policy.
- **S04-AC05:** Replay/retry does not duplicate accepted events; forged provenance, cross-user turns, and model-supplied canonical identity are rejected.
- **S04-AC06:** The UI confirms only persisted observations; failed extraction/save and partial storage completion are visible and recoverable.
- **S04-AC07:** Corrections/clarifications preserve traceable provenance and follow the declared versioned policy without creating contradictory hidden current values.

## Verification and completion record

Build an utterance matrix for all ten types, multiple clear observations, mixed ambiguity, non-trackable speech, explicit negatives, unknown doses, out-of-range ratings, relative time, and injected tool instructions. Check replay, cross-user access, provider malformed output, and persistence failures. Complete a live speech→turn→event→Timeline walkthrough.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Autonomous question selection, analytical conclusions, custom event types, medical inference, and silently changing the extraction contract.

## Documentation handoff

Update CONVERSATION with extraction/replay/correction decisions, DOMAIN if a deliberate contract evolution is required, PERSISTENCE for processing metadata, and DEMO with the capture milestone.

## Acceptance audit — 2026-10-03

All seven criteria have supporting implementation; all seven remain **partially verified**, rather than fully accepted. Code inspection is not proof of model interpretation or browser behavior.

| Criterion | Observed checks | Remaining checks |
| --- | --- | --- |
| S04-AC01 | Canonicalizer accepts all ten event types and multiple supplied candidates. Earlier actual endpoint/provider check saved one energy event. | Spoken single/multiple observations across all ten types; transcript accuracy and Timeline walkthrough. |
| S04-AC02 | Strict vocabulary rejects unknown keys; inconsistent clarification plus events is rejected; temporal ambiguity discards the whole candidate set. | Provider must recognize unsupported speech and mixed semantic ambiguity without silently omitting it. This depends on interpretation/prompt adherence. |
| S04-AC03 | Rating 0/10 endpoints, invalid 11, null quantities/intensity, and explicit negatives checked directly. | Live extraction must preserve those meanings rather than inventing ratings or doses. |
| S04-AC04 | Local-midnight yesterday, Warsaw DST gap/fold, and future-date clarification checked directly. Existing domain tests cover calendar lags/year boundaries. | Live temporal interpretation, explicit date/time input, and delayed clarification anchored to the original day. |
| S04-AC05 | Stable canonical IDs/duplicate coalescing; hosted busy claim, cached replay, cross-user claim/read rejection, unauthenticated GET 401, forged event provenance rejection. Earlier live endpoint retry retained one event. | Concurrent HTTP/provider requests, lost HTTP success response/reload, broader forged-input matrix. Owner-accessible RPCs are not a private server-only validation boundary; see CAPTURE. |
| S04-AC06 | Route returns success only after finish; hosted invalid replacement retained the old event, released lease recovered; actual capture/replay HTTP 200. | Browser pending/failure/reload UX, provider timeout/malformed output, actual storage outage, and process death/90-second lease expiry. |
| S04-AC07 | Hosted correction replaced one active event; clarification retained prior accepted value; stale revision rejected; four history revisions preserved. | Provider complete multi-event corrections, repeated corrections, typed-form UX and replay after reload. |

Checks performed: `pnpm test` (30 existing tests passed); temporary in-memory checks of actual capture schemas/canonicalizer; hosted two-user RPC/GET audit using synthetic records. Hosted audit used constructed canonical results, so it does not verify the extractor model. Synthetic records were removed; two disposable anonymous Auth accounts remain from this audit. No permanent capture test suite was added.

### Retrieval and conversation limits

Talk restores saved transcripts and capture outcomes through owned repository reads and GET `/api/capture`. Timeline reads canonical observations, capped at 500 records per source. Talk lists up to 100 conversations and 500 turns per conversation. These are UI browsing limits, not complete history exports.

The live voice session has `tools: []` and receives no saved-history or capture-result feedback. It cannot answer questions about stored observations, confirm a save, or resume prior voice context. The extractor receives only the original turn, latest explicit follow-up, and previous interpretations for that root. Clarification/correction currently uses the typed form under the original turn; a new spoken answer is a separate root and is not automatically linked.

### Manual acceptance checklist

Use a private demo session and inspect **capture cards and Timeline**, not spoken acknowledgments:

1. Say “My energy is four out of ten, and I had two beers yesterday.” Expect two observations; energy today, alcohol yesterday. Reload and select the same conversation: same values, no duplicates.
2. In separate turns cover stress, mood, soreness, workout effort, late meal, illness symptoms, and knee pain without intensity. Expect registered types, exact reported ratings, and unknown pain intensity. Check 0 and 10 endpoints.
3. Say “I drank coffee” and “I drank alcohol, but I do not know how much.” Expect unknown mg/count. Separately report no caffeine, no alcohol, and no pain: expect explicit absence, not missing data.
4. Say “My energy is four, and I am stressed” without a stress rating. Expect clarification and **no newly accepted subset** for that turn. Use its typed clarification form to supply the missing rating; expect a complete result.
5. Ask a question, discuss a future plan, quote another person's symptoms, and mention an unsupported concept. Expect no invented self-report. “Energy eleven out of ten” must not save a clipped/guessed rating.
6. Correct the original two-event turn using its form: “Actually I had no alcohol yesterday; my energy is still four.” Expect the negative alcohol event and retained energy, no old consumption event in Timeline. Submit another ambiguous correction: the previously accepted set must remain visible. Reload and check again.
7. Report an explicit past date and “recently.” Expect the supplied date and clarification for vague timing. If testing yesterday around midnight, compare with the profile time zone. Date-only UI deliberately does not claim an exact clock.
8. In browser DevTools, block `/api/capture` for one attempt. Expect failure with no saved confirmation; unblock and retry once, then reload: one accepted set. This checks network/UI recovery, not a real provider timeout or database outage.

Provider failure injection, exact DST fixtures, concurrent/lost-response scenarios, and security matrices remain developer checks; users need not alter secrets or database permissions to perform this checklist. Voice capability explanations and spoken retrieval require additional implementation and are not delivered by Stage 4's storage ACs.
