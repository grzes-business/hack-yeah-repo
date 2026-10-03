# Stage 5 — Deterministic morning check-ins

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

The app runs a resumable, predictable morning interview; AI phrases the question selected by code.

**Dependencies:** [Stage 4](stage-04-structured-observations.md); voice UI from Stage 3.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [conversation](../CONVERSATION.md), [domain](../DOMAIN.md), and [demo](../DEMO.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

The mode enum includes `morning_checkin`, but no controller exists. Initial dimensions are energy, soreness, mood, and illness. Accepted events and clarification outcomes from Stage 4 supply state; a model’s conversation summary is not the state authority.

## Implementation work

1. Define a pure controller such as `getNextQuestion(state)` around the four registered dimensions. Declare eligibility date/window, priority order, tie handling, already-known criteria, and terminal conditions.
2. Derive known/missing/clarification/skipped state from persisted accepted observations and explicit interview state. A skipped dimension remains unknown. Decide when earlier reports count for the current check-in and how corrections take precedence.
3. Select one question at a time with application code. Send the selected dimension/date/anchors to the model for phrasing; validate any attempted tool or mode transition against application permissions.
4. Route answers through Stage 4. A clear answer may fill several dimensions; update controller state from confirmed saved events, not merely from a model’s draft. Preserve all-or-clarify behavior.
5. Resume after reload/reconnect without repeating resolved dimensions. Persist the minimum state required for clarification, skip, and completion; define versioning and owner access if adding storage.
6. Offer explicit start, skip, end, and resume controls. Completion follows the controller’s declared rule and does not imply every dimension has a known value. Handle save failures without advancing prematurely.
7. Leave a clean extension seam for post-workout sessions, but do not introduce unapproved dimensions or ranking based on invented health importance.

## Decisions and constraints

Resolve the morning window, recency/completion policy, dimension priority, resumption lifetime, and skipped-question policy. These are application decisions documented before acceptance. The model cannot reorder dimensions or decide clinical urgency. `post_workout` exists as a future mode, not required implementation here.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S05-AC01:** For identical persisted state/date/policy version, the controller selects the same next question or terminal state.
- **S05-AC02:** Only energy, soreness, mood, and illness are requested, with correct date and rating/boolean meaning.
- **S05-AC03:** Already-known dimensions are not repeated unless the documented clarification/correction policy requires it; multi-dimension accepted answers update every applicable dimension.
- **S05-AC04:** An ambiguous or unsaved answer does not falsely complete a dimension; skip preserves unknown rather than zero/false.
- **S05-AC05:** Reload/reconnect restores interview progress and avoids duplicate accepted observations or repeated resolved questions.
- **S05-AC06:** Explicit stop/completion releases the session appropriately; failures offer recovery, and private interview state cannot be accessed by another user.
- **S05-AC07:** Model phrasing cannot select a different dimension, add health calculations, or invoke unauthorized modes/tools.

## Verification and completion record

Test the controller against every known/missing/clarified/skipped combination relevant to progression, multiple accepted answers, midnight/zone boundaries, resumed state, and failed persistence. Demonstrate a morning check-in ending with both fully answered and voluntarily skipped dimensions.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Investigation-driven question ranking, post-workout implementation, evidence calculations, experiments, and diagnostic interviewing.

## Documentation handoff

Update CONVERSATION with controller state and timing rules; DOMAIN/PERSISTENCE if interview state needs a new validated record; DEMO with repeatable check-in steps.
