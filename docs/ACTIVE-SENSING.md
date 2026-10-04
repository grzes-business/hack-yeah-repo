# Stage 9: active sensing

Stage 9 is implemented in `lib/questions/`, `/api/questions`, Evidence and the application-owned Talk dispatcher. Read [INVESTIGATION](INVESTIGATION.md) and [CAPTURE](CAPTURE.md) first. No new health variables or relationships are introduced.

## Deterministic policy: `questions-v1`

`selectBestQuestion()` validates the bundle and considers only its registered, dated missing references. A candidate must be subjective and `unknown/not_observed`. Known values (including false/zero), ambiguous reports, unavailable inputs and insufficient coverage are excluded. Objective gaps are never questions asking the user to estimate a wearable measurement.

Answerable dimensions: alcohol, stress, illness symptoms, workout RPE, caffeine dose and late meal. Sorting is deterministic: direct relationship factor first; then number of relevant registered relationships containing the reference, descending; then the fixed dimension order above; then date and feature lexicographically. Factor and confounder dates come from their registered lags exactly once. Questions include ISO local dates, registry rating anchors or explicit boolean semantics. The model does not select or rewrite question targets; the application renders the question.

Explicitly skipped or answered `(feature,date)` keys are excluded for the current investigation. A reported coffee with unknown mg is accepted raw data, but daily caffeine remains unknown; the answered key prevents repeated requests to guess a dose. A day without a workout is not an RPE of zero: skip that question. No eligible candidate ends questioning truthfully, without filling the remaining gaps.

## State and access

One `evidence_question_loops` row per account stores the investigation input, original/current validated snapshots, one selected question, exclusions, stop status, completed answer IDs and pending answer lease. Authentication derives the owner; public actions cannot supply a target, owner, bundle, raw event or source-turn ID. RLS permits only owned reads. Browser writes and `commit_question_loop` invocation are denied. The authenticated server uses the existing private Supabase writer.

Migration **010 is applied** to the hosted project. Do not replay it or prior creation migrations. Its private transaction takes the same owner generation lock as feature rebuilding, checks revision/generation/zone, and atomically records source turns, canonical events and the question receipt. The state references its investigation conversation; deleting conversations during full history reset cascades the loop. Auth account deletion also cascades state. SQL Editor application does not reconcile the CLI migration ledger.

State resumes across reloads, reconnects and tabs on the same authenticated account. A new date/outcome/scope replaces the single active loop. Starting the identical input preserves its original comparison and exclusions; an explicit start resumes a stopped loop. Different languages are different inputs. Current questions are in English; extraction accepts the supported spoken languages. The current active loop retains up to 100 answer receipts, then refuses further answers; changing the investigation starts a new loop. Raw turns/events remain in history.

## Answer and refresh transaction

1. Save a pending answer with stable ID, original text, original timestamp/source turn and a 90-second lease using a revision compare-and-swap. Another tab cannot submit a competing answer at that revision.
2. Call Stage 4's `extractCandidates()` with the trusted selected question as context, then `canonicalizeExtraction()`. Bare answers use the selected local date; explicit user dimensions/dates take precedence. Values remain schema validated and all-or-clarify. Exact uncertainty cannot become a guessed negative; full reports must support their own event types. Short answers can only support the selected dimension. A bare “no” cannot invent an RPE or stress rating.
3. Atomically save the original user answer, the dated assistant question, accepted raw events and completed-answer receipt. Explicit negatives become known false. Clarification/uncertainty saves no event; restate the complete answer with the requested detail. Question answers are additional observations; use the original capture card for explicit corrections.
4. Only after confirmed persistence, rebuild through the existing 44-day analytical range and investigate again. This includes the affected factor date and all registered lag dependencies. If rebuilding/provider explanation fails, the saved state remains `needsRefresh`; retry refresh without recapturing. Explanation failure alone uses Stage 8's fact-only fallback.
5. Compare actual daily states and historical counts/effects/labels. Ignore generation timestamps/provenance changes when describing a semantic value change. An answer for current context usually leaves historical association strength unchanged: display that explicitly. The comparison includes any intervening owned data changes; it does not attribute every change exclusively to the answer.

Provider/extraction failure retains the original pending text/ID with an expired lease; retry uses that same answer. An in-flight lease blocks simultaneous retries/skip/stop; after expiry, skip/stop may abandon it. A raw-data or zone change prevents stale answer commit. Refresh cannot reinterpret a pending answer against a different question: retry it or skip/stop it after its lease expires. A zone/policy change requires a new investigation.

Completed answer IDs replay without new events. Talk also records an application-owned assistant question marker alongside the original spoken turn. This marker prevents a lost voice receipt from reapplying the old answer after the question advances or another investigation starts. The persisted voice plan carries the application-selected loop/question identity; an unprocessed old turn cannot answer a different question. Historical voice receipts do not present superseded questions as active.

## Personal versus synthetic

Personal answers use canonical `capture:v1:` identities. When the user explicitly selects synthetic demonstration, accepted answers use `demo:question:` identities and are visibly labeled simulated. They are committed directly in that scope in one transaction, never temporarily stored as personal records. They use the same extraction, validation, feature building and analytical path; fixture latent values are never copied into missing observations.

Sample loading/removal targets its original fixture namespace; it does not clear the separate synthetic question answers. For a completely fresh demonstration use a fresh private demo account or the explicit Timeline **Clear all history** control. Never silently clear personal history for a demo.

## Verification

`pnpm test` includes question selection, lag/tie/exclusion contracts, strict action inputs, unknown/false/provenance semantics, answer guards and semantic before/after comparisons. `pnpm verify:questions` additionally creates and removes only disposable accounts for hosted RLS/writer denial, canonical provider extraction, negative capture, fresh recomputation, synthetic isolation, durable restore/skip/stop/termination, replay, simulated interrupted-refresh/failed-answer recovery, live typed voice dispatch, zone invalidation and history-reset cascading. Recovery fixtures simulate persisted interruption states; they do not claim to reproduce every real network/database outage. Physical microphone quality, spoken delivery and visual usability remain manual checks.
