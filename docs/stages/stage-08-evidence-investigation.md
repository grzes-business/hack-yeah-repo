# Stage 8 — Evidence-backed investigation and explanation

## Status and intended outcome

**Implemented 2026-10-04. Automatic checks and remaining acceptance are recorded below; physical microphone/audio checks remain deferred.**

The user can investigate an outcome/date and receive an explanation whose facts and numbers trace to a validated bundle.

**Dependencies:** [Stages 3](stage-03-live-voice.md), [4](stage-04-structured-observations.md), and [7](stage-07-deterministic-analytics.md).

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [evidence](../EVIDENCE.md), [conversation](../CONVERSATION.md), [domain](../DOMAIN.md), and [demo](../DEMO.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

`EvidenceBundle` already encodes current daily features, earlier context days, anomalies, registered results, dated missing factors, and limitations. Allowed outcomes are energy, HRV, and sleep duration. Stage 7 supplies calculations; Stage 3 supplies transport. No investigation orchestrator or explanation tool exists yet.

## Implementation work

1. Implement owner-verified orchestration such as `investigateOutcome({outcome,date})`. Validate the allow-listed outcome, local date, time zone, and input generation. User identity comes from verified auth, not the model/caller’s arbitrary user ID.
2. Read/build fresh current features and the earlier dates required by factor and confounder lags. Retrieve compatible baseline/anomaly/result outputs or recompute them. Define treatment of failed, uncomputed, stale, or insufficient historical analyses.
3. Assemble and validate the existing bundle. Current outcome lives in `dailyFeatures`; earlier facts live in `contextDays`. Missing factors include exact feature/date references justified by the registry. Do not duplicate or shift lag semantics in explanation code.
4. Preserve an unknown current outcome and honest limitations; no baseline comparison or anomaly is invented for missing input. Distinguish historical association from the explanation of one day.
5. Add an application-authorized investigation tool/mode. Supply the model only relevant structured evidence and communication rules. Untrusted speech/transcripts cannot grant access, select another owner, or expand the graph.
6. Render/phrase the bundle’s facts, usable counts, period, effect meaning, strength, and competing context. Explain association and uncertainty plainly. Define validation/fallback behavior for unsupported numerical claims or provider failure; a deterministic template is an acceptable fallback.
7. Decide whether bundles are assembled on demand or stored with explicit version/freshness metadata. Preserve reproducibility and owner isolation either way; storing them is not a prerequisite if validated orchestration suffices.

## Decisions and constraints

A relationship can be historically plausible while today’s context is unknown. Investigation does not require a positive explanation or stronger label. Resolve history period/cache/freshness and explanation fallback rules here; do not add custom outcomes or stats. Stage 9 owns asking the missing-factor question.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S08-AC01:** Only registered outcomes for the authenticated owner/date are investigated; unauthorized access and unsupported identifiers are rejected.
- **S08-AC02:** Bundles validate with consistent owner/zone/version, correct current/lagged dates, and only registered relationships/missing-factor references.
- **S08-AC03:** Unknown current outcomes, insufficient histories, failed analyses, and stale inputs remain explicit without fabricated anomalies/effects.
- **S08-AC04:** Every explanation number/count/date/effect/label is traceable to the supplied bundle; unsupported numbers or causal/diagnostic claims fail the declared handling policy.
- **S08-AC05:** Explanations distinguish historical association, competing context, and today’s uncertainty; no isolated-factor/adjustment claim is invented.
- **S08-AC06:** Provider failure still permits inspection of structured evidence and a truthful fallback; investigation does not falsely claim completion on storage/computation failure.
- **S08-AC07:** Mode/tool permissions are enforced by code; transcript injection cannot grant arbitrary metrics, cross-user access, or privileged writes.

## Verification and completion record

Test bundle assembly on known/unknown outcomes, all lags/confounders, insufficient/stale histories, cross-user calls, and computation failures. Use a fixed explanation evaluation corpus for traceable numbers and association language. Demonstrate live investigation and provider-failure fallback with the same structured facts.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Automatic missing-factor question selection, new relationships, causal explanations, and experiment proposals.

## Documentation handoff

Update EVIDENCE with orchestration/freshness, CONVERSATION with tool permissions/explanation rules, and DEMO with a reproducible outcome/date example.

## Implementation record - 2026-10-04

[INVESTIGATION](../INVESTIGATION.md) is the canonical policy. `lib/investigation/` assembles on-demand owned bundles and renders all explanations from approved facts. `/api/investigate` accepts only allow-listed outcome/date/scope/mode. Evidence controls and app-owned voice intent dispatch use the same service. Freshness checks cover provider latency and cached voice snapshots. Missing context is shown but no question is selected. No new migration is needed.

The provider only orders supplied fact IDs. Unsupported IDs, additional prose, omissions and duplicates are rejected, with deterministic fallback for invalid/unavailable provider output. No free model prose enters explanations. Automatic test outcomes are recorded after execution.

## Automatic verification - 2026-10-04

- `pnpm test`: 73/73 passed, including six analytics reference/fixture checks and six investigation checks. The explanation corpus covers all three outcomes with known/unknown current values; invalid fact selections, extra claims, omissions, duplicates, ordering requirements, provider failure and stale receipts are checked.
- Live `scripts/verify-investigation.mjs`: passed against localhost and hosted Supabase. Verified unauthenticated denial, strict owner/mode/outcome/payload/future-date rejection, seeded HRV comparison, exact prior-day context, independent unknown history for a second user, browser-writer denial, raw-change invalidation/rebuild, real provider fact ordering, typed voice requests for personal energy and explicit synthetic HRV, durable replay and stale-receipt handling after timezone change. Both disposable accounts and their records were deleted after each run. Existing user history was preserved.
- Automatic checks found and fixed a receipt compatibility issue: investigation remains an existing conversation receipt with a typed investigation field, so no migration/new database category is needed.
- Build, lint, TypeScript and diff checks passed. Physical microphone/audio fidelity and the later mobile UI remain outside these automatic checks. Provider-failure fallback was tested with injected failures; the live provider returned valid model ordering. No Stage 9 code was implemented.

AC01/AC02: contract, bundle and live owner/lag checks passed. AC03: unknown/insufficient/stale paths passed; no fabricated effects/anomalies. AC04/AC05: approved-fact corpus and guarded live rendering passed; no free model claims enter the output. AC06: injected provider failure/invalid selection fallback passed alongside live successful provider ordering. AC07: strict dispatch/payload and owner/writer checks passed; physical audio rendering is still pending manual review. This evidence does not certify every possible malicious speech utterance or future provider behavior.
