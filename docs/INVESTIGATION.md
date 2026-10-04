# Stage 8 outcome investigation

## Entry points and scope

`POST /api/investigate` accepts only mode `investigate`, an allowed outcome (`energy`, `hrv`, `sleep_duration`), one local date, personal/demo scope and en/pl language. Defaults: investigate/personal/en. JWT verification supplies ownership; caller owner, arbitrary metrics, bundles, raw facts and tool instructions are rejected. Future local dates are rejected. There is no arbitrary data query or model-controlled database tool.

Evidence has an investigation selector and inspectable bundle. Talk accepts requests such as “Investigate my energy today” through app-owned intent dispatch. Retrieval of subjective reports remains separate. Realtime still has no database tools: it reads the confirmed application explanation. The intent model selects only a schema-approved outcome/date/scope, then code executes the owned investigation. Synthetic mode requires explicit selection/request and is disclosed in the explanation.

## Orchestration and freshness

`lib/investigation/server.ts` runs Stage 7 owned analysis and rebuilds all required daily history, reads current/prior-day context, checks generation/zone, assembles the existing `EvidenceBundle`, explains it, and checks freshness again after provider latency. Three attempts bound changing-input retries. Computation/storage failure returns an error, never a fabricated complete investigation.

`bundle.ts` includes only relationships registered for the requested outcome, their historical periods, the current day and an explicit previous day. Missing references are deduplicated `{feature,date}` entries whose daily state is unknown at the factor/confounder's registry lag. Unknown current outcomes stay unknown and have no current anomaly. A historically evaluated relationship can coexist with an unknown current value/factor; it does not explain an individual day by itself.

Anomalies are restricted to the requested outcome. Baseline comparisons appear in the explanation only when the bundle contains a validated anomaly; the separate Stage 7 inspector retains other baseline diagnostics. No new baseline numbers are invented by the explainer.

Bundles are assembled on demand, not a new database table/cache. Voice receipts retain a dated evidence snapshot under the existing durable ledger; cached/history retrieval strips that snapshot and replaces its reply when generation, profile zone, builder/scope or analysis version is incompatible. A new utterance requests fresh evidence. Freshness describes the read, not a promise against future writes. Cross-tab changes require a new request/history refresh; no Supabase realtime subscription is claimed.

## Grounded explanation policy

`facts.ts` deterministically renders an outcome, eligible historical results/counts/periods/effects, relevant context and limitations. Each fact has a stable ID and bundle paths supporting its wording/numbers. Missing context is displayed; Stage 8 does not select or ask a missing-factor question.

The provider uses [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) with the existing `OPENAI_API_KEY` and extraction-model configuration, `store:false`, no tools and a 15-second timeout. It receives only relevant rendered facts (no raw transcript, owner secret or unrestricted history). It may return only a permutation of the supplied IDs. Code rejects unknown IDs, added prose, duplicates and omitted facts, requires synthetic disclosure first when present, the current outcome next, and interpretation limits last; approved wording and numbers are always rendered by application code. This prevents model-produced unsupported numerical, causal or diagnostic claims from entering the explanation instead of relying on a fragile prose filter. Order selection is the model's only discretion in this version.

Provider refusal, timeout, malformed/incomplete output, missing configuration or invalid selection uses the same facts in deterministic order. The response identifies `model_ordered` or `deterministic_fallback` and a bounded fallback reason. Provider failure leaves the valid structured evidence inspectable. An evidence-computation failure cannot masquerade as a provider fallback.

Each explanation distinguishes historical association from current context, carries sparse-data/unknown states and states that confounders were not adjusted. The exposure comparison refers to prior-day reported exposure, not standardized alcohol dose. No diagnoses, treatment, confidence probabilities, causal attribution or new relationship edges are generated.

## Automatic checks

`pnpm test` now includes analytics references and investigation tests. `pnpm verify:investigation` runs that suite and a localhost/hosted check. It creates two disposable anonymous accounts, seeds only one with synthetic history, checks auth/strict requests, unknown independent history, writer denial, generation invalidation, live provider ordering and typed voice dispatch/replay, then deletes only its created accounts and cascading records using the server key. No existing user's history is modified. It requires the local server plus public/server Supabase configuration and uses the existing provider key when available.

Injected provider-failure/invalid-plan tests verify fallback automatically. The hosted script records the actual provider/fallback path; it does not certify physical microphone or audio-renderer fidelity. Stage 9 question selection, response capture and before/after evidence loop are intentionally excluded.

Completion record (2026-10-04): 73 automatic tests passed; live disposable-account API/provider/voice-dispatch checks passed, including explicit synthetic HRV selection. Build/lint/type/diff checks passed. Voice investigations persist under the existing conversation receipt category with a typed evidence field; no migration was needed. Physical microphone/audio review remains deferred until the owner returns to manual checks. Stage 9 is implemented separately in [ACTIVE-SENSING](ACTIVE-SENSING.md).
