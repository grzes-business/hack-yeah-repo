# Stage 3 voice implementation

## Status

Implemented on 2026-10-03; **live/provider/browser and hosted transcript acceptance remain pending**. Type checking, lint, and a production build passed. No automated tests, live provider calls, hosted verification, or browser microphone checks were run in this implementation turn. The user will perform the microphone/provider conversation walkthrough manually. The presence of an API key was checked without printing it; presence does not prove billing/model access.

## Configuration and transport

Set `OPENAI_API_KEY` in `.env.local` or server deployment secrets. Optional `OPENAI_REALTIME_MODEL` defaults to `gpt-realtime-2.1`; the input transcription model is `gpt-4o-mini-transcribe`, output voice `marin`. Restart the development server after configuration changes; redeploy for hosted configuration changes. Never prefix provider variables with `NEXT_PUBLIC_`.

The integration uses the [official unified WebRTC flow](https://developers.openai.com/api/docs/guides/voice-webrtc): browser SDP offer → authenticated app server → `POST /v1/realtime/calls` → SDP answer → browser peer connection. This approach returns an SDP answer, not an ephemeral API key. The standard provider key stays on the server. Audio and provider events subsequently travel directly between browser and provider. See [Realtime conversation events](https://developers.openai.com/api/docs/guides/realtime-conversations).

No new SDK, schema, migration, or provider credential in the browser is required. Use a current WebRTC-capable browser on HTTPS or localhost; actual supported-browser versions must be recorded after manual acceptance. The native WebView is not verified here.

## Implemented boundaries

- `app/api/voice/session/route.ts`: validates a Bearer Supabase JWT with `getUser(token)`, derives ownership, uses the public Supabase key plus caller JWT/RLS, validates a bounded SDP request, creates an owned `capture` conversation, and forwards server-selected configuration. Returns generic recoverable errors rather than provider bodies/secrets. Responses are not cached; provider setup times out after 25 seconds.
- `lib/conversation/transport.ts`: owns microphone tracks, WebRTC peer/data channel, playback, mute, cancellation, connection timeout, errors, and cleanup. Browser setup times out after 40 seconds; normal demo calls close after 10 minutes. These are application UX limits, not a server-enforced billing cap.
- `lib/conversation/events.ts`: accepts only the defined user transcription and assistant audio-transcript delta/final events; validates canonical finalized turns. Tool messages cannot trigger application actions.
- `app/components/voice-conversation.tsx`: user controls, transcript/history, owner-specific recovery queue, save status/retry, and session cleanup. The component remounts on owner changes. Repository writes verify the expected owner for voice turn/conversation saves.
- `app/(product)/talk/page.tsx`: hosts the capture experience within the existing shell.

The provider session has no tools and `tool_choice: none`; there are no health extraction/investigation/experiment dispatchers. A capture-only prompt prohibits health reasoning and false save claims. Application permissions are enforced by available code paths, rather than relying on model compliance to authorize writes. Spoken-model adherence still needs manual evaluation; absence of tools does not itself prove every reply will respect the prompt.

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
