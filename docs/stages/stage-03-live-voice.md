# Stage 3 — Live voice and persistent transcript

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

A user can start/stop a voice conversation, see finalized transcript turns, and restore its persisted history without health reasoning.

**Dependencies:** [Stages 0](stage-00-domain-contracts.md) and [1](stage-01-web-persistence.md); Stage 2 is useful demo context but voice transport does not depend on fixture generation.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [conversation](../CONVERSATION.md), [persistence](../PERSISTENCE.md), and [architecture](../ARCHITECTURE.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

`app/(product)/talk/page.tsx` is a placeholder. Conversation/turn schemas, repository persistence, authenticated browser sessions, and the `capture` mode already exist. There is no voice provider integration or server session-authentication layer yet. “GPT-Live” describes the intended experience, not a frozen SDK/model/transport choice.

## Implementation work

1. Inspect installed Next.js guidance. Select a supported current voice API/model/transport from official provider documentation. Record browser compatibility, latency approach, cancellation, usage/cost limits, and configuration. Keep the integration behind a small conversation transport boundary.
2. Implement a server session endpoint that validates the caller’s Supabase JWT, derives the owner, and issues only the provider’s appropriately scoped short-lived client authorization. Provider credentials stay server-only. Define expiry, rejected auth, and resource cleanup behavior.
3. Add microphone/session controls with explicit idle, requesting permission, connecting, active, stopping, and failed states. Start from a user gesture; stop tracks and remote resources when the user ends the session or leaves the experience.
4. Track conversation IDs and stable turn IDs. Render interim transcript separately from finalized text; persist only the defined finalized boundary. Record user/assistant role and canonical timestamps. Decide how an interrupted turn is represented without silently inventing words.
5. Persist conversation lifecycle and turns through verified owner access. Handle duplicate final events/reconnects idempotently. Separate “heard/transcribed” from “saved”; show failed persistence and retry rather than claiming success.
6. Restrict the session to `capture`. Enforce allowed tools/modes in application code. The assistant may converse but cannot claim to have extracted observations, calculated evidence, or diagnosed the user.
7. Support transcript/history viewing, explicit connection errors, denied/unavailable microphones, network drop, expired authorization, provider failure, and missing provider configuration. Keep the rest of the shell usable.

## Decisions and constraints

Resolve transport, model, finalized-turn boundary, interruption/reconnect policy, and retention policy here before coding their consumers. Do not assume browser Supabase auth implies server cookies. Do not send unrelated history to the provider. The transcript is untrusted input and cannot grant tools or expand permissions. Event extraction remains separate Stage 4 work.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S03-AC01:** An authenticated user can start a supported-browser voice session, speak, hear a response, stop it, and see final user/assistant transcript turns.
- **S03-AC02:** Persisted conversation/turn ownership, role, timestamps, and IDs validate; reload shows the same finalized history.
- **S03-AC03:** Interim text is distinguishable from finalized persisted turns; duplicate final notifications/reconnect replay do not duplicate accepted turns.
- **S03-AC04:** Permission denial, unavailable microphone, missing config, expired auth, connection loss, and provider failure produce clear recoverable states.
- **S03-AC05:** Stopping/unmounting releases microphone and remote session resources; a failed save remains visibly unsaved until confirmed.
- **S03-AC06:** Unauthorized session requests fail; provider secrets never appear in client assets/responses/logs, and private conversations remain owner-scoped.
- **S03-AC07:** Capture mode cannot invoke analytics, investigation, experiment, or canonical event-writing tools; no unimplemented health result is announced.

## Verification and completion record

Use mocked transport events for state/replay/failure checks, hosted ownership checks for turns, and a real microphone/provider browser walkthrough for start→speak→persist→reload→stop. Record browser/provider/model versions and observed limitations. Code-only checks cannot certify live audio.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Canonical subjective extraction, morning questioning, evidence explanation, native audio/HealthKit, or changing the domain graph.

## Documentation handoff

Update CONVERSATION and ARCHITECTURE with transport/auth/lifecycle choices, README/.env.example with server-only variable names, and PERSISTENCE if turn lifecycle needs schema changes.
