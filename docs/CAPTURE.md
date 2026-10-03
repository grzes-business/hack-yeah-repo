# Stage 4 structured observation capture

## Status and entry points

Implemented 2026-10-03. Migration `202610030003_turn_extractions.sql` was applied successfully to the existing hosted Supabase project through SQL Editor. Type/lint/build checks passed; **live extraction, two-user integration, failure/replay, and correction acceptance checks remain pending**. No automated tests or live extraction requests were run during the initial implementation. The timestamp incident checks below subsequently verified one live capture and cached replay; the broader acceptance matrix remains pending. The user confirmed Stage 3 live voice works; that confirmation does not verify every Stage 3 failure/security criterion.

The capture pipeline is finalized saved user turn → authenticated `/api/capture` → owned extraction claim → provider candidate → deterministic date/value validation → atomic event/result save → UI confirmation. The live voice model still has no health-writing tools. No feature builder, statistics, autonomous question controller, or investigation was added.

## Configuration and boundaries

The existing server `OPENAI_API_KEY` is reused. Optional `OPENAI_EXTRACTION_MODEL` defaults to `gpt-4.1-mini`. Extraction uses the [Responses API Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) with `store: false`; the provider receives only the root transcript, latest explicit clarification/correction, prior interpretation, anchor date, and time zone. The app does not send the whole health history.

- `lib/capture/contracts.ts` defines transport candidates and capture request/display schemas. The nullable wire fields accommodate strict provider JSON output; they are not additional domain variables.
- `lib/capture/provider.ts` requests structured candidates with registry anchors, all-or-clarify, unknown-dose, temporal, and correction rules. It provides no tools and requires a completed response.
- `lib/capture/canonicalize.ts` validates value semantics with existing draft schemas, resolves local dates/clocks, supplies canonical IDs/provenance, sets confidence null, and validates the complete result. It does not attach a workout session without an established verified link.
- `lib/db/server.ts` verifies a Bearer Supabase JWT and derives the owner. The capture endpoint reads stored owned turns; client-supplied transcript, owner, event, timestamp, or provenance fields are not accepted.
- `app/components/turn-capture.tsx` runs once after a user turn is confirmed saved and capture history is loaded, with explicit retries. Assistant turns, synthetic fixture turns, and correction transcript rows do not auto-extract as independent roots.

Provider output and transcript text remain untrusted. Structural validation rejects unsupported fields/values; prompt adherence and semantic extraction accuracy still need the utterance acceptance matrix. There is no claim that a JSON schema proves the report is true.

## Time and value policy

The initial claim freezes the original turn timestamp, transcript, profile time zone, and capture timestamp. Retry uses that frozen context; editing the original root transcript/time is rejected. Use an explicit correction or a new turn instead.

Relative dates are anchored to the original turn’s local date, including when clarifying later. Today/now without a clock uses the original turn instant. Yesterday/days-ago/explicit past dates without a clock use **representative local noon** to retain the reported calendar day; this is not a claim about the actual occurrence time. Capture cards and captured Timeline entries show date/zone rather than an invented clock. Explicit HH:mm is resolved by code; nonexistent or ambiguous DST clocks require clarification. Future or unresolved dates do not become guessed observations. Arbitrary source/time-zone history is not inferred.

Ratings retain the reported 0–10 value and anchors. Qualitative energy/stress without a numeric rating needs clarification. Pain can have unknown location/intensity; alcohol count and caffeine mg may remain unknown. Reported absence is a known zero/false under the existing value schemas. No report creates no event, and no diagnosis or dose estimate is inferred.

Version 1 remains **all-or-clarify per utterance**: ambiguous required meaning/timing saves no partial new event subset. `nothing_trackable` and `needs_clarification` are persisted outcomes. Invalid/incomplete provider output is a failed attempt, not a successful empty capture. Exact duplicate candidate records within one extraction are coalesced; distinct reports retain separate events.

## Durable replay and atomic persistence

`turn_extractions` is keyed by `(user_id, root_turn_id, extractor_version)` with version `capture-v1`. It holds root/source turn references, frozen context, revision, latest outcome, last accepted captured result, revision history, and a lease. Owner SELECT is granted; direct browser table writes are denied. New RPCs operate only on `auth.uid()` and owned capture-mode user turns:

- `claim_turn_extraction`: serialized root claim, cached completed result, 90-second lease, and optional explicit follow-up creation. A completed replay uses cached data rather than calling the model again.
- `finish_turn_extraction`: checks the lease/provenance and atomically replaces the tracked accepted event set, stores the new result/revision, and releases the lease. Any failed event write rolls back the entire transaction.
- `release_turn_extraction`: marks a failed lease expired so retry can resume the frozen source/context. If the request dies, expiry enables recovery after 90 seconds.

The provider call has a 40-second timeout; the route declares a 60-second deployment duration. The lease prevents concurrent completed captures from overwriting one another. Stable event IDs hash root/source turn IDs plus event ordinal; a lost HTTP success response is recovered through the cached transaction result. The browser never confirms candidates before the transaction succeeds.

Security-definer RPCs use a fixed empty search path and explicit authenticated ownership. Their execution is granted to authenticated users and denied to unauthenticated users. As with existing owner-writable raw tables, a determined account owner can directly call these RPCs with their own payload; SQL validates ownership/structural provenance, not every Zod value constraint or provider authenticity. They are not a private credential-protected server channel. RLS isolates users; the application’s shared validation determines accepted app semantics. No privileged key was added and derived table permissions remain unchanged.

## Clarification and correction

A direct UI form lets the user clarify or correct a specific original turn. This is explicit capture recovery, not an autonomous interview. A typed follow-up is saved as a new owned user turn with stable `capture:<request UUID>` identity; it is linked to the root through extraction bookkeeping. Duplicate submissions of the same ID/text recover the same outcome. Changing text requires a new request ID. Stale revision submissions require reloading before correction.

The extractor is asked for a complete replacement interpretation of the original statement, retaining unaffected observations. Only a fully validated `captured` result replaces prior accepted events. Clarification, nothing-trackable, provider failure, or transaction failure leaves the previous accepted set intact; the UI says so. A correction such as “I did not drink” can replace consumption with an explicit negative. A non-trackable follow-up does not silently erase health history; there is no implicit clear/delete action.

Original transcripts and result revisions remain traceable. Superseded canonical events are preserved in extraction history snapshots but are removed from the active raw-event set to avoid conflicting current observations. Future Stage 6 must invalidate/rebuild derived data on these replacements before analytics is activated. This stage does not add a separate general deletion/audit export workflow.

## UI, failure, and resumption

Talk displays pending, captured, nothing trackable, needs clarification, interrupted/processing, and failed states per root turn. Successful cards show readable accepted values and local dates. The prior accepted result remains visible while a correction needs clarification. Timeline reads the same canonical event table and labels them conversational observations.

Loading saved history restores outcomes. A missing result can be automatically extracted once history is loaded; an interrupted/failed lease uses explicit Retry capture. Transcript-save recovery remains independent: unsaved turns cannot be extracted. Typed unsent follow-up text is not durably stored; losing it requires re-entry. A follow-up already prepared in the ledger can be retried from the original turn after reload.

Capture history follows the existing 500-turn conversation browsing limit. Leases bound duplicate work, not global abuse/cost. Anonymous users and owner-editable raw records retain the previously documented demo security limits. Production retention, hard usage limits, stronger SQL value validation, and deletion workflows require deliberate later scope.

## Manual acceptance matrix

Run when requested/authorized and record actual results under Stage 4 AC IDs:

- All ten event types: numeric ratings/endpoints; explicit negatives; unknown alcohol/caffeine quantities; knee pain with unknown intensity; multiple clear observations.
- Mixed ambiguous + clear input: no partial write; unknown concepts/questions/future plans: no invented variable; prompt injection: no extra fields/tools.
- Today/yesterday at local midnight, explicit past dates, cross-year cases, DST gaps/folds, and a late clarification anchored to the original day.
- Replay/reload, concurrent capture, provider malformed/incomplete output, expired lease, failed transaction, and lost response: no duplicates or false saved status.
- Clarification and complete correction: new source transcript, stable replay, stale revision rejection, prior set retained on failure, and one current event set after success.
- Two-user isolation and forged transcript/provenance attempts, plus speech→saved turn→saved observation→Timeline walkthrough.

A representative manual phrase is “My energy is four out of ten, and I had two beers yesterday.” Confirm both observations and their separate dates; then correct alcohol on the original turn and inspect Timeline/reload.

## Capture 503 incident — 2026-10-03

The response “Observations were not confirmed. Retry to recover the transaction result.” came from `finish_turn_extraction`. Reproduction against hosted Supabase returned `P0001 / Event provenance mismatch`: Postgres `now()` retains microseconds, while the application canonicalizes `capturedAt` with JavaScript `Date.toISOString()` to milliseconds. The original equality check therefore rejected otherwise valid events.

Additive migration `202610030004_capture_timestamp_precision.sql` was applied through hosted SQL Editor. It compares event `capturedAt` with `date_trunc('milliseconds', j.captured_at)`; ownership, source, zone, occurrence bounds, lease checks, and atomic correction remain intact. Existing failed claims retain their frozen context and can be retried. Apply this migration after 003 on other environments.

Focused diagnosis verified the original database failure, then one synthetic saved turn through the actual localhost `/api/capture` route and live provider: HTTP 200, captured result, revision 1, one persisted event. Replay returned HTTP 200 with the same revision and one event. Synthetic database records were removed; two disposable anonymous Auth accounts remain. This does not verify all event types, correction, concurrency, or cross-user capture acceptance.

The route now logs only failed database operation names and error codes, plus a validation/internal category for unexpected failures. It does not log transcripts, observation payloads, or credentials.
