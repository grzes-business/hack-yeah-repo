# Stage -1 — Shared project knowledge

## Status and intended outcome

**Implemented; acceptance checkpoint: 2026-10-03. Recheck affected criteria when changing behavior.**

A contributor can understand the product, find the governing rules, and implement an authorized stage without relying on conversation history.

**Dependencies:** Existing starter inspection; no feature-stage prerequisite.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [architecture](../ARCHITECTURE.md), [domain](../DOMAIN.md), [conversation](../CONVERSATION.md), [evidence](../EVIDENCE.md), and [demo](../DEMO.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

The original starter was Next.js + Supabase. The repository now also contains Stages 0–2. Documentation work must preserve that code and the current hosted setup. `CLAUDE.md` routes to `AGENTS.md`; keep one agent entry point.

## Implementation work

1. Inspect the repository before describing it. Identify actual routes, libraries, scripts, migrations, environment conventions, and existing instructions. Distinguish inspected implementation from planned architecture.
2. Maintain `CONTEXT.md` as the canonical thesis, vocabulary, trust boundary, constraints, non-goals, data/agent concepts, and demo narrative. Explain why wearable measurements and conversational observations complement each other.
3. Maintain `AGENTS.md` as the reading route and change protocol. Link focused domain, architecture, evidence, conversation, persistence, fixture, and demo references; preserve generated Next.js guidance.
4. Keep the roadmap concise. Put stage implementation work, dependencies, decisions, observable ACs, verification, and handoff in `docs/stages/`. Keep an index with current status and an issue/resumption scaffold.
5. Separate shared rules from stage execution guidance. Link authoritative definitions rather than introducing competing registries, thresholds, or database schemas. Record settled user decisions and unresolved choices explicitly.
6. Check local links, stage coverage, terminology, and documentation-only change scope. Record completion without changing runtime code.

## Decisions and constraints

The documentation hierarchy is: product thesis in `CONTEXT.md`; shared domain meanings in `DOMAIN.md` and contracts; architectural boundaries in `ARCHITECTURE.md`; stage execution/ACs here. If these disagree, inspect the implementation and resolve the inconsistency before making a feature change. Conversation previews and old illustrative examples do not override accepted contracts.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **SM1-AC01:** `CONTEXT.md` states the product thesis, evidence boundary, non-goals, raw/derived distinction, provenance, missingness, and mock/native separation.
- **SM1-AC02:** `AGENTS.md` routes a fresh agent to the relevant stage and governing references, and explains how to approach changes and report completion.
- **SM1-AC03:** The index and guides cover every stage from -1 through 14, with dependencies, implementation scope, decisions, observable ACs, verification, and exclusions.
- **SM1-AC04:** Implemented behavior is distinguished from future work; provider choices, analytical cutoffs, and illustrative experiment values are not presented as settled requirements.
- **SM1-AC05:** Local documentation links resolve; original starter and existing feature code/configuration are preserved.

## Verification and completion record

Review all stage titles against the roadmap. Check local Markdown targets and inspect the diff for code/dependency/migration changes. No application tests are necessary solely because documentation changed.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Feature implementations, package installation, database changes, voice/provider setup, analytics, native work, and creating GitHub issues.

## Documentation handoff

Keep the stage index, roadmap, README, CONTEXT documentation map, and AGENTS reading route synchronized. Add future canonical guidance only when a stage needs it.
