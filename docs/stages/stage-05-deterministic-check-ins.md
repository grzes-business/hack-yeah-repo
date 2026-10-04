# Stage 5 — Deterministic morning check-ins

## Status and intended outcome

**Implemented 2026-10-04; acceptance pending.** The live walkthrough must be recorded before acceptance. Hosted inventory on 2026-10-04 confirmed `morning_checkins` exists; migration 006 was not reapplied.

The app runs a resumable, predictable morning interview; AI phrases the question selected by code.

**Dependencies:** [Stage 4](stage-04-structured-observations.md) and [Stage 4.5 voice reliability](stage-04a-voice-reliability.md); voice UI from Stage 3. Reuse the confirmed-outcome and clarification controller from Stage 4.5 rather than rebuilding that loop.

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

## Implementation record — 2026-10-04

Decisions made in code (document changes here if they change):

- **Window:** starting, answering and skipping are open only from 05:00 to 12:00 in the user's profile time zone (`lib/checkin/controller.ts`, `CHECKIN_WINDOW`). Outside it the card reports closed; an ended check-in stays ended for that local date.
- **Priority:** energy, soreness, mood, illness. Fixed in code; the model cannot reorder them.
- **Which reports count:** accepted subjective events whose local date equals the check-in date, from one day before to one day after in UTC terms, excluding `demo:` fixtures. Corrections count through the accepted set. Illness counts an explicit yes or no.
- **Skips:** stored per user and local date in `morning_checkins` (migration `202610040006`). A skipped dimension stays unknown; it is never recorded as zero or false. A skip applies only to the question currently due.
- **Completion:** all four answered, or every dimension answered or skipped (reported separately). Explicit end is terminal for the local date.
- **Phrasing:** deterministic questions built from registry anchors. The seam for model phrasing is `questionFor`; the model may not change the selected dimension.
- **Answers:** given in the existing voice conversation and saved through Stage 4.5; the card reads back accepted observations after refresh. Reading the question aloud through the voice session is not implemented.

Checks performed: typecheck, lint, production build, 60/60 Node tests (including `lib/checkin/controller.test.ts`: order, skips, completion, window edges, midnight in the user's zone, determinism, question anchors), and unauthenticated/bad-token rejection on `/api/checkin`.

Hosted schema inventory on 2026-10-04 confirmed the migration 006 table is present. No reapplication was performed.

Not yet performed: a live check of GET/POST `/api/checkin` with a real session (answer → counted, skip persisted, end persisted, cross-user denial); a morning-window run in the user's local time; and the spoken check-in walkthrough.
