# Stage 3 voice implementation

## Status

Implemented on 2026-10-03; **the user confirmed live voice works; other failure/security/hosted transcript acceptance remains pending**. Type checking, lint, and a production build passed. No automated tests, live provider calls, hosted verification, or browser microphone checks were run in this implementation turn. The user will perform the microphone/provider conversation walkthrough manually. The presence of an API key was checked without printing it; presence does not prove billing/model access.

## Configuration and transport

Set `OPENAI_API_KEY` in `.env.local` or server deployment secrets. Optional `OPENAI_REALTIME_MODEL` defaults to `gpt-realtime-2.1`; the input transcription model is `gpt-4o-mini-transcribe`, output voice `marin`. Restart the development server after configuration changes; redeploy for hosted configuration changes. Never prefix provider variables with `NEXT_PUBLIC_`.

The integration uses the [official unified WebRTC flow](https://developers.openai.com/api/docs/guides/voice-webrtc): browser SDP offer → authenticated app server → `POST /v1/realtime/calls` → SDP answer → browser peer connection. This approach returns an SDP answer, not an ephemeral API key. The standard provider key stays on the server. Audio and provider events subsequently travel directly between browser and provider. See [Realtime conversation events](https://developers.openai.com/api/docs/guides/realtime-conversations).

No provider credential or new SDK is required in the browser. Stage 4.5 adds migration 005 for processing receipts. Use a current WebRTC-capable browser on HTTPS or localhost; actual supported-browser versions must be recorded after manual acceptance. The native WebView is not verified here.

## Implemented boundaries

- `app/api/voice/session/route.ts`: validates a Bearer Supabase JWT with `getUser(token)`, derives ownership, uses the public Supabase key plus caller JWT/RLS, validates a bounded SDP request, creates an owned `capture` conversation, and forwards server-selected configuration. Returns generic recoverable errors rather than provider bodies/secrets. Responses are not cached; provider setup times out after 25 seconds.
- `lib/conversation/instructions.ts`: audio-rendering rules. Capabilities, capture feedback and retrieval summaries are selected by the application; intent classification and extraction remain model interpretation, not proof of speech or meaning.
- `lib/conversation/transport.ts`: owns microphone tracks, WebRTC peer/data channel, playback, mute, cancellation, connection timeout, errors, and cleanup. Browser setup times out after 40 seconds; normal demo calls close after 10 minutes. These are application UX limits, not a server-enforced billing cap.
- `lib/conversation/events.ts`: accepts only the defined user transcription and assistant audio-transcript delta/final events; validates canonical finalized turns. Tool messages cannot trigger application actions.
- `app/components/voice-conversation.tsx`: user controls, transcript/history, owner-specific recovery queue, save status/retry, and session cleanup. The component remounts on owner changes. Repository writes verify the expected owner for voice turn/conversation saves.
- `app/(product)/talk/page.tsx`: hosts the capture experience within the existing shell.

The provider session has no tools and `tool_choice: none`. The separate app controller can capture, follow up and retrieve owned reports; investigation and experiments remain unavailable. Application permissions are enforced by available code paths, rather than relying on model compliance to authorize writes. Spoken-model adherence still needs manual evaluation; absence of tools does not itself prove every reply will respect the prompt.

## Transcript policy

User finalization: `conversation.item.input_audio_transcription.completed`. Assistant finalization: `response.output_audio_transcript.done`. Their delta events are displayed as live, unsaved text. Empty/invalid transcripts are ignored; a failed transcription shows a notice and does not invent a turn.

IDs combine application conversation UUID, role, provider item ID, and content index. Duplicate finalized events are ignored during the call; persistence upserts by owner/ID. The app assigns occurrence timestamps when the finalized event arrives, not at the start of the spoken utterance. Display ordering follows those timestamps; asynchronous input transcription may finish after an assistant turn. This is a transcript-arrival timeline, not a reconstructed audio timing record.

Stopping immediately closes tracks, peer/channel, and playback. Only final events received before stop are saved; unfinished speech/drafts are discarded. Interrupted assistant final text can contain generated words that were not heard. The UI discloses this. Stop/reconnect always starts a new conversation; it does not resume provider context or send saved history back to the provider.

## Persistence and recovery

The server creates the conversation before connecting. Finalized turns and conversation closure are saved through the existing owner-verified repository. The UI distinguishes not saved, saving, and acknowledged saves. A failed write blocks a new call until the user retries pending changes.

Pending canonical records are held in memory and mirrored to owner-specific `sessionStorage` when available. Reloading the same tab restores its recovery queue; **closing the tab, clearing browser data, or blocked storage can lose unsaved changes**. This is not a durable outbox. Finalized transcript copies remain private app data and must not be logged.

Leaving the page attempts a closure save and retains a recovery copy. Browser termination, abort during setup, or unreachable storage may leave `ended_at` null; history labels this as “end not recorded”, not proof that the microphone is still active. Server setup failures attempt a closure update. Setup counts as a new conversation even if the provider connection fails.

History is explicitly bounded to 100 conversations and 500 turns per conversation. It is a browsing view, not a complete analytical export. Raw transcripts stay unchanged; Stage 4 owns structured extraction, correction policies, and event provenance.

## Usage and security limits

The endpoint limits an owner to three recorded capture starts in a rolling minute using an RLS-scoped database count. This is a demo throttle, not an atomic distributed rate limiter: concurrent requests can race, and anonymous account creation can bypass per-user limits. Configure provider project spend limits before public use; production abuse controls and hard call termination need a separate implementation.

No service-role credential is used. Owning a demo account permits writing its raw transcript via existing RLS policies; these are user-supplied records, not cryptographically attested provider statements. Future extraction must validate them accordingly. The app stores text, not audio recordings; provider processing/retention is governed separately by the provider account configuration.

## Manual acceptance checklist

Run these checks only when requested/authorized; record actual results in the Stage 3 guide.

1. Start a private demo session; allow microphone access; start voice; speak; hear an answer; stop. Confirm the microphone indicator disappears.
2. Confirm final user/assistant turns become saved and reload the same owned conversation. Repeat final event/retry cases without duplicate IDs.
3. Exercise permission denial, blocked playback, unavailable microphone, missing/bad key, expired Supabase auth, provider/network drop, stop while connecting, and navigation cleanup.
4. Exercise failed persistence and same-tab reload recovery; verify the UI never labels unsaved turns as saved.
5. Verify another user cannot access the transcript, missing/invalid Bearer auth cannot initialize voice, and provider secrets do not appear in responses/assets/logs.
6. Ask for unsupported diagnosis, evidence calculations, structured capture, and tool/mode changes. Confirm application code dispatches none; evaluate spoken adherence separately.
7. Record browser/model/API configuration, actual costs/latency if measured, and unresolved cases. No clinical interpretation is part of these checks.

## Stage 4 extension

Finalized saved user turns enter the Stage 4.5 app controller described below. It invokes structured capture only for reports or selected follow-ups; see [CAPTURE](CAPTURE.md).

## Noise and accidental response tuning — 2026-10-03

New calls use explicit provider noise reduction and server VAD settings. The Talk controls choose laptop/room (`far_field`, default) versus headset/close (`near_field`) microphone filtering, and less-sensitive (`threshold: 0.7`, default) versus normal (`0.5`) speech detection. Both retain 300 ms of prefix audio and wait 800 ms of silence before ending a turn. Settings are locked during a call and apply to the next call; reload restores defaults. The API validates the two enums and maps them to server-owned settings.

The browser requests echo cancellation and noise suppression, with automatic gain disabled to avoid amplifying quiet background sounds. Browser/device support varies. Higher VAD thresholds can miss quiet speech; Normal is the fallback. An 800 ms pause can make replies a little slower. Provider noise reduction runs before VAD/model processing; see the [official audio settings](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create) and [VAD guide](https://developers.openai.com/api/docs/guides/realtime-vad).

The live prompt now asks for silence on breath/noise/side conversations, one clarification only for unintelligible speech clearly addressed to the assistant, direct short answers, and honest capability limits. It gets the ten supported event labels from the existing registry. Transcription instructions prohibit invented words for non-speech without seeding example health reports. No transcript-length heuristic removes legitimate short answers or ratings.

This reduces false triggers; it does not guarantee speech/source classification or prevent hallucinated transcripts. Automatic responses and interruptions remain enabled for natural conversation. A nonempty final transcript still follows the existing save/extraction pipeline; the live assistant still has no retrieval/save tools or capture-result feedback. No claim is made that breathing is now impossible to capture incorrectly. Mute provides explicit control between reports; push-to-talk would be a separate stronger control if tuning is insufficient.

Manual microphone acceptance remains pending (user owns this check):

1. Stop the old call, select the actual microphone type, and start a fresh call. Stay silent/breathe normally for 20 seconds; expect no spoken response or new health observation. Try a sigh, throat clearing, and typing.
2. Say an ordinary sentence and a clear energy rating; expect intelligible transcription and one natural reply. Check a short greeting, a one-word answer, and brief pauses inside a sentence.
3. If normal quiet speech is missed, restart using Normal detection. Compare with less-sensitive mode on the same microphone.
4. Ask what the app tracks and what you recorded yesterday. Expect concrete supported categories, and honest lack of voice retrieval with a pointer to history/Timeline.
5. Mute/unmute, interrupt an answer, then stop. Confirm audio/cleanup/save behavior still works. Check capture cards independently of spoken acknowledgments.

`pnpm lint`, `pnpm typecheck`, and `pnpm build` passed after this change. No automated tests or live microphone/provider sessions were run for this tuning. Hardware acoustic behavior and model adherence are unverified until these checks run.

## Next implementation stage

[Stage 4.5 — Voice reliability](stages/stage-04a-voice-reliability.md) now owns the remaining voice interaction work and its acceptance gate before morning check-ins. Its retrieval, spoken follow-up, response-control, and press-to-speak features are planned; the current tuning does not implement them.

## Stage 4.5 controller — 2026-10-03

Implemented, **acceptance pending**. Default input is press-to-speak: idle tracks are disabled; hold with pointer or Space/Enter, release to commit once. Cancellation/focus loss discards a held recording; focus loss also mutes the session. Continuous mode uses server VAD with automatic responses and interruptions disabled. Microphone profiles retain far-field/near-field reduction and 0.7/0.5 thresholds. Physical audio behavior remains user-owned verification.

The app saves final text before POST `/api/voice/turn`. Server-verified ownership, a structured intent allow-list and a durable frozen plan determine capture, selected follow-up, bounded retrieval, capability reply, cancellation, unsupported/unclear reply, or silence. Realtime receives an out-of-conversation `response.create` with empty input and application-selected text; it has no database tools or unrestricted health history. Speech adherence still needs a manual check. Generation/item tracking suppresses replies from old speech, interrupted requests and stopped sessions; visual results remain available.

Capture feedback names committed values or asks the stored clarification question. Select an original card for voice follow-up; successful current reports select their root automatically. Only a clearly linked answer/correction uses that root; unrelated reports remain independent. The owner-specific target survives same-tab reload in sessionStorage, can be explicitly cleared, and is revalidated on the server. Multiple pending roots require deliberate selection. New provider sessions do not restore conversation memory. Typed clarification remains available.

Retrieval supports today, yesterday, an explicit date, or an inclusive range of at most seven days, optionally filtered by one registered type. Dates use the profile zone and saved query turn date. Read at most 1,000 rows in a UTC envelope, filter exact local days, return up to 100 canonical events and explicit completeness. Synthetic `demo:` events are excluded unless explicitly requested and then labeled. Empty results never mean a reported negative. Up to four results are spoken; the returned list is displayed. Stored feedback is a snapshot for that turn, not a continuously refreshed report.

Retry saved turns from their history card. Migration 005 stores immutable intent/target/revision and final receipts under owner-scoped 120-second leases. Capture retains its own 90-second lease and stable follow-up request identity. Direct receipt writes are denied; owner RPCs retain the trust limitation documented in CAPTURE. A provider/save error produces a visible recovery state and no save-success claim. Hard abuse limits, a durable audio outbox and a verified native browser matrix remain outside this stage.

`pnpm verify:voice` is an opt-in hosted/provider regression run against localhost (override with `VOICE_VERIFY_ORIGIN`). It creates two anonymous users, uses synthetic statements, removes their records and leaves Auth accounts. It incurs provider usage. Live attempts exposed inconsistent mixed-report/negative-correction interpretation; those failures remain open. See the stage guide for exact acceptance status and manual walkthrough.

## Independent reports versus corrections — 2026-10-04

Manual Stage 6 checks exposed a voice-routing defect: after a successful capture, the UI automatically kept that completed root selected, and the intent model treated a second caffeine intake and a later alcohol-negative report as corrections. Inspection of current canonical records and voice receipts confirmed replacement rather than aggregation failure: only the second caffeine amount and the corrected alcohol absence remained. The stored second caffeine instant was 11:00 Europe/Warsaw on October 3; date-only display did not mean day-only storage.

Automatic targeting now continues only while a capture needs clarification; successful capture clears it. Explicit card selection still permits corrections. The server additionally requires correction language before a completed target can be replaced; an independent statement, even of the same type or contradicting the first, routes as a new report. The classifier prompt carries those examples. Use “Correct that report: …” after selecting a completed card. Existing durable receipts remain cached; this fix does not reinterpret them or restore superseded observations.

Recheck manually with two new reports of explicit mg at different past clocks, then rebuild their day: both active source records must contribute to the sum. Independently report alcohol intake and absence on the same date: both active records must remain and the daily feature must be unknown/ambiguous. Explicitly select a card and say “Correct that report: …” to check that correction still replaces only that root. Pending clarification should still target its original root. Static lint/type/build checks do not certify microphone/provider behavior.

## Stage 10 voice-first integration

Talk carries explicit selected interview context and defaults to personal reporting after reload. Morning check-in can be started through its button or the spoken command “Start morning check-in.” The server derives the actual due question, maps a bare answer through canonical extraction, and advances only after confirmed observations or explicit unknown/skip. An old account-level investigation cannot intercept ordinary reports. Investigation speech selects a short subset of validated facts plus a limitation and one question; full evidence remains in Insights. Normal text answer/correction forms are removed; saved-turn retries and original-report selection remain. Physical microphone acceptance remains pending.
