# Stage implementation guides

These guides preserve the implementation context in the repository so work can resume without chat history. Read [AGENTS](../../AGENTS.md), [CONTEXT](../../CONTEXT.md), the relevant guide, and its canonical references before editing code.

## Current checkpoint

As of **2026-10-03**, Stages **-1, 0, 1, and 2 are implemented**. Stage 1 hosted/browser acceptance and Stage 2 fixture/ingestion/replay/removal checks passed. **Stage 3 is implemented with live/provider/browser acceptance pending. The user confirmed live voice works. Stage 4 structured capture is implemented with behavioral acceptance pending; Stage 5 check-ins follow.** The guides themselves do not authorize future-stage implementation. Previous checks describe that checkpoint, not a guarantee about a later checkout or hosted configuration.

The starter remains Next.js + Supabase. Hosted Supabase, anonymous demo sign-in, three applied SQL migrations, private raw persistence, and synthetic sample-history load/removal are available. Capture-only voice and transcript persistence are implemented but await live acceptance. Structured extraction is implemented with behavioral acceptance pending. Check-in controllers, daily builders, statistics, investigation, active questions, native integration, and experiments are still future work.

## Guides

| Stage | Guide | Status |
| --- | --- | --- |
| -1 | [Shared project knowledge](stage-minus-1-context.md) | Implemented |
| 0 | [Domain contracts](stage-00-domain-contracts.md) | Implemented |
| 1 | [Web and persistence foundation](stage-01-web-persistence.md) | Implemented |
| 2 | [Mock source and canonical ingestion](stage-02-mock-ingestion.md) | Implemented |
| 3 | [Live voice and persistent transcript](stage-03-live-voice.md) | Implemented; acceptance pending |
| 4 | [Canonical structured observations](stage-04-structured-observations.md) | Implemented; acceptance pending |
| 5 | [Deterministic morning check-ins](stage-05-deterministic-check-ins.md) | Planned |
| 6 | [Deterministic daily feature pipeline](stage-06-daily-features.md) | Planned |
| 7 | [Deterministic analytics](stage-07-deterministic-analytics.md) | Planned |
| 8 | [Evidence-backed investigation and explanation](stage-08-evidence-investigation.md) | Planned |
| 9 | [Missing evidence and active sensing](stage-09-missing-evidence-loop.md) | Planned |
| 10 | [Evidence-first product UI](stage-10-evidence-ui.md) | Planned |
| 11 | [Capacitor shell](stage-11-capacitor-shell.md) | Planned |
| 12 | [Apple Health source adapter](stage-12-healthkit-adapter.md) | Planned |
| 13 | [Real-data hardening](stage-13-real-data-hardening.md) | Planned |
| 14 | [Personal experiments](stage-14-personal-experiments.md) | Planned |

## Shared decisions every stage must preserve

- **AI can communicate evidence; AI cannot create evidence.** Code owns registries, alignment, calculations, counts/effects/labels, selected questions, tool permissions, and confirmed persistence.
- Version 1 freezes nine metric keys, ten subjective event types, 0–10 ratings with anchors, 19 daily feature keys, and four relationships. [DOMAIN](../DOMAIN.md) and `lib/domain/` own exact definitions.
- Sleep belongs to wake date. Sleep→energy uses lag 0; alcohol→HRV, stress→sleep, and workout RPE→energy use lag 1. Factor/confounder dates are relative to outcome date; never apply a lag twice.
- Absence is unknown, not zero/false. Known features retain raw provenance. Synthetic ground truth is for testing, never for imputing observations or explaining user evidence.
- Extraction uses model-facing drafts followed by application-owned canonicalization. Version 1 is all-or-clarify for an utterance; partial capture requires an explicit contract change.
- Current auth is browser-persisted Supabase Auth, not SSR cookies. New backend operations must verify a user JWT and derive ownership. Derived tables deny browser writes; future trusted writers must preserve that boundary.
- Hosted migrations were applied manually. Do not reapply them or push a CLI ledger blindly. No local PostgreSQL replacement is required.
- A candidate formula, proposed function name, provider integration, or original illustrative experiment is not an approved implementation merely because it appears in a guide. Resolve choices in their owning stage and canonical document.

## How to resume a stage

1. Inspect repository status and current code. Preserve unrelated changes. Read the stage’s prerequisites and completion records; do not rebuild completed foundations.
2. State the authorized stage/outcome and affected boundaries. Treat proposed function/module names as suggestions until implementation establishes their actual location.
3. Resolve listed decisions when required. Routine engineering choices may be made and recorded; changes to agreed scope/contracts need explicit discussion. Read current official API/platform documentation when integrating providers or native software.
4. Implement the work breakdown within the stated exclusions. Add/update canonical documentation in the same change when behavior or a decision becomes settled.
5. When verification is requested/authorized, execute the guide’s boundary checks and relevant project checks. A verification plan is not a passed result. Do not run live checks merely to validate documentation.
6. Record date/revision, actual checks, representative inputs/outputs, remaining limitations, and precise status. Update the guide, index, roadmap, and routing if needed.

## Acceptance and evidence rules

AC IDs are stable review references: `SM1-AC01` for Stage -1 and `S00-AC01` through `S14-AC…` for the rest. They cover successful behavior plus uncertainty, security, replay, and failure cases. Do not mark a stage complete because only its happy path works.

Pure tests verify calculations/contracts/controllers; integration checks verify authenticated persistence and provider boundaries; browser checks verify the user flow; physical-device checks verify real native access. None substitutes for another. Existing `pnpm verify:hosted` creates disposable anonymous Auth users and cleans their records, but leaves the Auth accounts; use deliberately. Numerical synthetic validation does not establish clinical validity.

If an external prerequisite prevents an AC check, record the stage as implemented but acceptance pending (or partially implemented), with the exact unmet criteria. Preserve clear distinctions between planned, implemented, and verified. Old completion evidence should remain dated when new changes require revalidation.

## Future GitHub issues

Use one umbrella per stage and reference this guide instead of copying a second specification. Split child issues by independently reviewable boundary, retaining the relevant AC IDs and prerequisite links. Documentation readiness does not mean the feature has shipped.

```markdown
Title: Stage N — [name]
Outcome: [from stage guide]
Context: AGENTS.md; CONTEXT.md; docs/stages/[guide]; relevant canonical references
Baseline: [existing modules and prerequisite checkpoint]
Scope: [work packages; child issues if needed]
Acceptance: [stage AC IDs, plus any explicitly agreed additions]
Dependencies: [stage guides / issues / external prerequisites]
Decisions: [unresolved choices owned by this stage]
Excluded: [adjacent-stage work]
Verification: [pure / hosted / provider / browser / device checks as applicable]
Handoff: [canonical docs and completion evidence to update]
```

## Ownership of documentation

[ROADMAP](../ROADMAP.md) owns sequence and umbrella scope; these guides own stage work/ACs. [CONTEXT](../../CONTEXT.md) owns product intent. [DOMAIN](../DOMAIN.md), [ARCHITECTURE](../ARCHITECTURE.md), [CONVERSATION](../CONVERSATION.md), [EVIDENCE](../EVIDENCE.md), [PERSISTENCE](../PERSISTENCE.md), [FIXTURES](../FIXTURES.md), and [DEMO](../DEMO.md) own shared rules and implemented details. Update the authority for a decision, then link it from the stage; do not maintain conflicting copies.
