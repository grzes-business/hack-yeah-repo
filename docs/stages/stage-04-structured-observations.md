# Stage 4 — Canonical structured observations

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

Finalized user speech creates only validated predefined observations, with auditable turn provenance and accurate capture/clarification feedback.

**Dependencies:** [Stage 3](stage-03-live-voice.md), using Stage 0 schemas and Stage 1 ownership/persistence.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [conversation](../CONVERSATION.md), [domain](../DOMAIN.md), and [persistence](../PERSISTENCE.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Final user turns will exist after Stage 3. `lib/domain/events.ts` already defines draft and canonical extraction schemas. Subjective event persistence and turn references already exist. Stage 2 subjective fixtures are reference inputs, not a replacement for live extraction.

## Implementation work

1. Trigger extraction from a finalized persisted user turn. Read it under verified ownership; do not trust an arbitrary caller-supplied transcript/turn ID as evidence of ownership. Keep extraction execution separate from voice transport and persistence.
2. Give the extractor the allowed event vocabulary, explicit rating anchors, temporal context, and draft output schema. Parse the returned discriminated outcome before accepting anything. Unknown speech returns nothing trackable; unresolved required meaning returns clarification.
3. Preserve version 1 all-or-clarify: multiple clear observations may be captured together, but an ambiguous extraction must not silently save a partial subset. Unknown quantities allowed by the schema can remain null; do not force an invented number to avoid clarification.
4. Application code resolves relative dates in the user’s IANA zone, assigns stable accepted IDs/capture timestamp/time zone/turn provenance, and validates canonical records. Associate workouts only with verified relevant sessions; never let the model forge session or ownership fields.
5. Define idempotent processing per source turn and extraction version. Stable event ordinals/IDs must survive retries; track processing outcome if needed with an explicit storage design. Avoid duplicate writes when provider callbacks/reloads replay.
6. Persist validated events and display exactly what was confirmed. Distinguish pending, saved, nothing trackable, clarification required, and failed. Clarification/correction links must preserve the originating turn rather than rewriting history invisibly.
7. Handle provider/schema failures and storage partial failures with retry and honest status. Changing an accepted observation must have documented replacement/supersession semantics before later feature builders depend on it.

## Decisions and constraints

Settled: 0–10 scales; model drafts omit canonical provenance; all-or-clarify. Resolve event timestamp defaults, ambiguous relative dates, extractor versioning, retry ledger, and correction semantics. “My knee hurts” can express pain with unknown intensity; it does not authorize a diagnosis. Do not infer caffeine mg or alcohol standard drinks from unspecified language.

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
