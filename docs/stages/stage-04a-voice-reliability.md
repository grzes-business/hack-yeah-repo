# Stage 4.5 — Voice reliability and grounded conversation

## Status and intended outcome

**Accepted 2026-10-04 by the project owner** after the fix round below. The owner confirmed the physical microphone walkthrough; the automated record is in the fix-round section. Turn control, confirmed feedback, selected spoken follow-ups, bounded retrieval and durable receipts are in place. Hosted live-model attempts exposed inconsistent extraction/correction; physical microphone acceptance remains user-owned. This stage is not certified complete.

A person can report, clarify, correct, and retrieve supported observations in voice, with deliberate turn-taking and truthful confirmation. Stabilize this before Stage 5 morning interviews. Stage numbers 5–14 and their existing AC IDs remain unchanged.

**Dependencies:** implemented [Stage 3 transport](stage-03-live-voice.md) and [Stage 4 capture](stage-04-structured-observations.md). Close the affected outstanding Stage 3/4 criteria while doing this stage; do not relabel them all passed.

## Context and inspected baseline

Read [AGENTS](../../AGENTS.md), [CONTEXT](../../CONTEXT.md), [VOICE](../VOICE.md), [CAPTURE](../CAPTURE.md), [CONVERSATION](../CONVERSATION.md), and [DOMAIN](../DOMAIN.md).

- `app/api/voice/session/route.ts` creates an authenticated Realtime capture session. Noise reduction, two microphone profiles, VAD thresholds, and a more explicit prompt exist. Hardware behavior remains unverified.
- `lib/conversation/transport.ts` manages WebRTC, microphone, mute, interruption, and cleanup. Automatic responses are now disabled; the app requests only selected feedback.
- `lib/conversation/instructions.ts` supplies audio-rendering rules; application code supplies capabilities and confirmed text. It cannot grant actual access to saved data or prove a save succeeded.
- `lib/conversation/events.ts` accepts final transcription events. `voice-conversation.tsx` persists them and displays history.
- Stage 4 supplies validated extraction, leased replay, atomic replacement, and a typed clarification form. Coffee without mg is valid; unrated soreness needs clarification. Mixed ambiguous reports wait together under all-or-clarify.
- The live model has no tools. The app controller supplies bounded confirmed feedback and routes clearly linked spoken follow-ups to a selected owned root.

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. This stage uses the existing ten subjective event types and 0–10 anchors. It introduces no analytics, diagnoses, inferred doses, or new tracked variables.

## Implementation order

### 1. Control audio and response turns

Make response eligibility application-controlled instead of replying to every VAD boundary. Design explicit states for listening, awaiting a final transcript, processing capture, clarification, replying, and stopped/error. Preserve valid short answers such as “zero”, “no”, and greetings; a text-length cutoff is not speech classification. Record how interruption cancels pending responses and prevents late replies from an old turn/session.

Keep continuous listening with validated microphone profiles and add a press-to-speak option for noisy settings. Implement WebRTC commit/interruption sequencing using current official provider guidance. Outside intentional recording in that mode, disable input tracks; release finalizes at most one utterance. Cover pointer cancellation, keyboard access, focus loss, stop, and navigation. Mode selection must not unexpectedly start recording.

Do not claim that VAD or a prompt guarantees speech detection. Inspect actual microphone behavior, rejected turns, and normal speech. If classification is uncertain, request confirmation or clarify without creating a guessed report. Keep diagnostic metadata free of transcripts, audio, observations, and secrets.

### 2. Connect spoken replies to confirmed application state

Provide the conversation with validated capture outcomes: processing, captured, needs clarification, nothing trackable, or failed. Announce a save only after transaction success; never equate hearing/transcribing with saving. Associate outcomes with exact session/root turn/revision, and ignore stale callbacks. Queue/cancel replies explicitly so late saves cannot interrupt unrelated speech.

Use direct short replies and one useful question. Silence/background sounds should receive no chatter. A clear question about the app should receive a concrete answer even though it produces no health event. Distinguish unsupported capabilities, unavailable information, ambiguous speech, and insufficient evidence. Acknowledge mistaken interpretation plainly and describe the actual correction result. Keep prompts discoverable and versioned; retain a truthful deterministic fallback for provider failure.

### 3. Resolve clarification and correction in voice

Persist or reliably restore the pending original root/source/revision. Route a clearly linked spoken answer through the existing follow-up transaction rather than independently auto-extracting it. When several roots could be intended, ask which one; never silently correct the latest unrelated record. Explicit cancel/skip leaves the report unresolved and prior accepted data intact.

For mixed reports, supply complete replacement context: a soreness rating resolves the same turn's coffee plus soreness, rather than losing the coffee. Relative dates remain anchored to the original turn. Preserve replay, stale-revision rejection, history, and one current accepted event set. Keep the typed form as a recovery path.

### 4. Add bounded retrieval of saved reports

Implement an authenticated, allow-listed read operation for existing subjective observations by type and local date/range. Derive owner from verified auth; validate date, time zone, type, and range bounds in code. Use existing repository range reads and canonical schemas. Return provenance, explicit unknown values, and completeness/truncation status; do not use the Timeline's 500-record cap as proof of a complete search.

Supply only relevant validated results to the voice session. “What did I record yesterday?” must reflect persisted observations rather than conversation memory. Empty results mean no matching records were found, not that no coffee/alcohol/pain occurred. Exclude synthetic demo fixtures by default or label them explicitly when requested. Any returned numbers are stored values or deterministic counts; unsupported claims use a factual fallback.

If introducing a Realtime tool dispatcher, document the changed Stage 3 boundary: allow only the specific read/capture-feedback/follow-up operations implemented here. Enforce identity and arguments on the server; untrusted speech cannot expand access or directly construct arbitrary database writes. Stage 8 retains evidence investigation.

### 5. Make verification repeatable

Add a focused regression corpus when verification is requested: the actual coffee/soreness failures, all ten types, unknown/negative values, ambiguity, relative dates, repeated correction, and non-report speech. Separate pure controller/schema tests, mocked provider failures, hosted ownership/atomicity checks, live model interpretation, and physical microphone checks. Report individual failures; no percentage based solely on code presence.

## Acceptance criteria

- **S045-AC01 — Noise and intentional input:** On each supported microphone profile, silence, breathing, sighs, typing, and handling noise do not produce spoken replies or accepted health events in the recorded acceptance run. Press-to-speak accepts no input outside its recording window. Normal speech and short legitimate answers remain usable; record device/browser/model/settings and observed misses/false triggers.
- **S045-AC02 — Turn lifecycle:** One accepted finalized turn causes at most one intended reply. Interrupt, mute, stop, focus loss, and reconnect cannot create stale replies, duplicate captures, or active orphan microphones.
- **S045-AC03 — Honest confirmation:** Spoken and visual confirmations agree with the committed result. Provider/save failure produces no success claim; late callbacks are matched to root/revision/session.
- **S045-AC04 — Useful communication:** Capability questions name supported types and anchors correctly. Unsupported requests, unavailable data, unintelligible speech, and mistakes get concrete truthful responses; no invented analysis or repetitive filler.
- **S045-AC05 — Spoken clarification:** An unrated soreness report followed by an explicit rating resolves its original root. A combined coffee/soreness report retains both after clarification. Skip/unrelated speech and multiple pending roots follow the documented policy without guessed linkage.
- **S045-AC06 — Correction and recovery:** Spoken corrections atomically replace the intended set, preserve unaffected observations and provenance, retain old accepted data on failure, and survive replay/reload without conflicting current values.
- **S045-AC07 — Grounded retrieval:** Saved-date/type queries return actual owned canonical reports, correct local dates, unknown quantities, and completeness/source labels. The voice answer agrees with those results; empty retrieval never becomes a reported negative.
- **S045-AC08 — Permissions:** Missing/invalid auth, cross-user queries/follow-ups, forged provenance, out-of-scope tools, and instruction injection cannot read or alter another user's data or enable health analysis.
- **S045-AC09 — Failure UX:** Transcription/provider/storage failure, disconnection, concurrent processing, and lost responses have truthful visible/spoken states and explicit recovery. Pending clarification can resume or be explicitly cancelled; sensitive data is absent from diagnostic output.
- **S045-AC10 — Completion evidence:** The regression corpus and a real microphone report→clarify→save→retrieve→correct walkthrough have recorded results. Close affected Stage 3/4 AC gaps individually; list remaining unsupported devices/cases and actual latency observations.

## Decisions to settle during implementation

Record the continuous-listening gate, default input mode, interruption/reply ordering, pending-root selection and lifetime, retrieval range/size limits, reconnect/resumption context, tool dispatch design, and supported microphone/browser matrix. Prompts alone must not decide ownership, commit success, or correction targets. Do not change all-or-clarify or the event registry to hide a failing case.

## Handoff and subsequent work

Update VOICE for implemented audio/session mechanics, CONVERSATION for state/communication rules, CAPTURE for follow-up integration, and ARCHITECTURE/AGENTS when tool permissions change. Update PERSISTENCE/domain contracts before adding new durable state. Store actual verification results here without transcripts from real users.

Next is [Stage 5](stage-05-deterministic-check-ins.md), then features (6), analytics (7), and investigation (8). Excluded here: morning interview selection, new HealthKit work, personal experiments, medical advice, and relationship explanations. Retrieval of stored reports does not certify later evidence-stage ACs.

## Implementation and verification record — 2026-10-03

Decisions and module paths are recorded in [VOICE](../VOICE.md). Press-to-speak is default; continuous mode suppresses automatic replies. Selected root is explicit, with automatic selection after a current successful report and same-tab restoration. Retrieval is at most seven days/100 returned events, with a 1,000-row candidate cap and truthful truncation. No Realtime tool dispatcher was introduced. Migration 005 was applied to hosted Supabase; no earlier migration was replayed.

Code verification: production build, TypeScript, lint and `git diff --check` passed; 36/36 Node tests passed (six focused conversation checks plus 30 existing tests). Tests cover contracts, all-or-clarify, committed feedback, idle microphone gating, one commit, cancellation, manual responses, playback interruption, cleanup and late-transcription suppression. These mocks do not establish real microphone behavior.

Hosted/provider attempts exercised mixed-report clarification, unknown coffee dose, dated retrieval and cached replay successfully in some runs. **Failures remain:** negative correction retained earlier consumption or dropped the unaffected event; a later run captured a mixed unrated soreness report instead of asking for clarification. Prompt changes explicitly encode negative zero semantics and complete replacement preservation, but have not established reliable behavior. The full opt-in `pnpm verify:voice` run has not passed; do not treat checks later in that script as verified.

| AC | Current evidence / remaining check |
| --- | --- |
| AC01 | Mock press gating passes; physical silence/breath/typing on both profiles pending. |
| AC02 | Mock lifecycle/interruption/late transcription checks; real reconnect/navigation/output sequencing pending. |
| AC03 | Feedback uses committed records; hosted loss/failure and spoken agreement pending. |
| AC04 | Concrete deterministic capability/fallback replies implemented; live communication corpus pending. |
| AC05–06 | Selected follow-up/replay implementation exists; live extraction failures above prevent acceptance. |
| AC07 | Some dated/type reads and unknown dose verified; empty/demo/truncation/full script and spoken agreement pending. |
| AC08 | Server ownership/RLS checks implemented; full hosted cross-user/injection suite pending. |
| AC09 | Visible retry, frozen plans and leases implemented; comprehensive outage/concurrency/lost-response checks pending. |
| AC10 | Repeatable scripts/tests present; complete passing corpus and physical walkthrough pending. |

Manual walkthrough: start press-to-speak, verify silence outside hold; report coffee plus yesterday's soreness; answer its rating; retrieve today's caffeine/yesterday's soreness; explicitly correct coffee to none and verify both current records; interrupt, mute, leave/reload and retry. Repeat continuous mode with breathing/typing and each microphone profile. Record actual browser/device/settings and latency. Stop at a misleading save or dropped/guessed observation and report its card state. Stage 5 remains gated by these unresolved voice criteria.

### Fix round — 2026-10-04

Manual findings from the walkthrough and their status:

- **Tab switch muted the microphone and dropped replies (AC02/AC09) — fixed in code.** Leaving the tab no longer mutes or invalidates finished turns; it only discards an unfinished press-to-speak hold and says so. Continuous listening keeps running while the tab is hidden. Physical microphone confirmation pending.
- **HRV question asked for a date range, then reported other types (AC04/AC07) — fixed.** The intent schema now carries `unsupportedMetric`; a retrieval of an untracked measurement gets a truthful “I don't have saved reports for …” reply. A deterministic word backstop (`lib/conversation/unsupported.ts`) also applies. Verified by the hosted script.
- **Coffee + soreness: caffeine dropped after clarification (AC05) — prompt and live-verified only.** The follow-up prompt now requires re-extracting every original observation the answer does not contradict. The hosted corpus passes this case; the guarantee is model-dependent, and the app does not yet check that unrated items keep their original observations.
- **Negative correction spread to other items (AC06) — partly fixed.** `lib/capture/correction-guard.ts` removes new observations that neither the original report nor the correction mentions, refuses a correction that drops an accepted observation, and refuses a negated coffee/alcohol that still reports consumption. Unit-tested (`lib/conversation/corrections.test.ts`); the live “did not drink any coffee” case now saves caffeine=no with other types intact.
- **“One” saved as a drink count and soreness 1/10 (AC05) — fixed in code, hosted-verified.** The all-or-clarify result now lists every open item (`eventTypes`, legacy single `eventType` still reads). A report with an unrated soreness and an unknown drink count asks one question for both (“How many drinks did you have today, and how sore were you yesterday from 0 to 10?”). A follow-up is accepted only when every open item gets a value and no single number answers two items; otherwise nothing is saved and the app asks again for the open items. Unknown caffeine doses are final values, not open items.
- **Bare cancel on a completed card became a “no alcohol” correction (AC03) — fixed.** A bare cancel phrase (cancel, skip, never mind, stop, anuluj, pomiń) is now a cancel, never extraction. The reported 4-beers → “No alcohol reported” change is consistent with that path; it has not been reproduced in a live run.
- **Listening paused by tab switch (privacy decision) — implemented.** Hiding the tab or losing window focus closes microphone input and shows a message; returning resumes listening. Finished turns and replies are unaffected. Physical confirmation pending.
- **Spoken answer to a pending selected card is a follow-up (AC05).** While the selected card is awaiting clarification, a spoken report is applied as its answer, not as a new report. This is a deliberate policy; the model's report/followup split is no longer authority there.
- **Cancel after 4 beers saved “no beverage” — not reproduced in code; needs the exact history entry.** Cancel never writes an observation in `app/api/voice/turn/route.ts`; the text likely comes from alcohol events without a beverage name.
- **Logout / unauthenticated access (AC08) — checked against the API.** `/api/capture` and `/api/voice/turn` return 401 without a session or with an invalid token; the hosted script also checks cross-user 404 and direct-write denial.

Checks run on 2026-10-04: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (46/46), and `pnpm verify:voice` (hosted and live model; passed end to end, including the one-case review line). Still not run: physical microphone walkthrough on laptop and headset, tab-switch with a real microphone, and any repeated live runs to measure consistency.
