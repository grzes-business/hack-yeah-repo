# Stage 1 — Web and persistence foundation

## Status and intended outcome

**Implemented; acceptance checkpoint: 2026-10-03. Recheck affected criteria when changing behavior.**

An authenticated demo user can store private canonical records, restore their browser session/profile, and navigate the product shell.

**Dependencies:** [Stage 0](stage-00-domain-contracts.md).

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [persistence](../PERSISTENCE.md), [architecture](../ARCHITECTURE.md), and [setup](../../README.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Next.js product routes are under `app/(product)/`; shared browser session/navigation/profile code is under `app/components/`. `/status` retains starter diagnostics. `lib/db/` contains typed records/repository access. `lib/supabase.ts` creates typed clients and returns null when unconfigured. Hosted Supabase is active; anonymous sign-in is enabled. No local PostgreSQL setup is required.

## Implementation work

1. Preserve the starter and add clear domain, health, database, and product boundaries using existing pnpm/TypeScript conventions. Keep Today, Talk, Evidence, and Timeline minimal until their owning stages.
2. Use the existing one-click anonymous demo flow. Restore browser auth, initialize the profile without overwriting saved choices, and validate display name/time zone updates. Treat anonymous identity as browser-dependent, not a durable cross-device account promise.
3. Maintain the seven tables: profiles, conversations, conversation turns, metric samples, subjective events, daily features, relationship results. Store validated canonical raw payloads with queryable metadata. Keep ownership out of `MetricSample`; attach verified owner at the persistence boundary.
4. Enforce RLS and owner-scoped composite references. Browser users can manage their own intended raw records; derived features/results are readable by their owner but not browser-writable. Authentication, owner, and cross-record provenance must be checked independently of payload correctness.
5. Keep typed database access aligned with applied migrations and validate records entering/leaving repositories. SQL constraints are defense in depth, not a complete substitute for shared Zod validation.
6. Keep the app buildable/renderable without Supabase credentials; show setup state rather than querying during build or on `/status`. Keep secrets out of browser bundles and committed env files.
7. Document hosted setup, applied migration status, auth limitations, and test cleanup. Existing migrations were applied via SQL Editor; reconcile the CLI migration ledger before any future automated push.

## Decisions and constraints

Auth currently persists in the browser client, not SSR cookies. Future server endpoints must verify a supplied user JWT and derive ownership; they cannot assume server-rendered session state already exists. The generated database type snapshot is maintained manually. Do not introduce an ORM or privileged browser client. Do not reapply the existing hosted migrations.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S01-AC01:** Today, Talk, Evidence, and Timeline are navigable; unfinished areas accurately describe their status, and `/status` preserves deployment/configuration diagnostics.
- **S01-AC02:** One-click anonymous sign-in creates an authenticated session/profile; reload restores it and preserves saved profile settings.
- **S01-AC03:** Each of the seven tables has the documented RLS policy/grant boundary; two users cannot read or modify each other’s records.
- **S01-AC04:** Cross-user conversation/turn/event references fail even when the caller owns the newly inserted record.
- **S01-AC05:** Derived writes from browser users fail; unauthenticated private reads are denied; malformed owned records fail repository validation.
- **S01-AC06:** Canonical round trips preserve timestamps, identity, value semantics, and provenance; relational timestamp normalization remains documented.
- **S01-AC07:** A production build and page rendering work without public Supabase credentials, and secrets are neither committed nor exposed to clients.

## Verification and completion record

Checkpoint 2026-10-03: browser signup/profile/session restoration, hosted ownership/FK/grants checks, build/lint/types, and missing-credential build/render passed. Future storage changes should use two-user integration checks. `pnpm verify:hosted` is opt-in and creates disposable anonymous Auth accounts; test records are cleaned, accounts remain without an administrative cleanup key.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

Voice, canonical extraction execution, deterministic features/statistics, native adapters, production account recovery, and a local PostgreSQL replacement.

## Documentation handoff

Update PERSISTENCE, migrations/type snapshots, setup instructions, and ARCHITECTURE when storage/auth boundaries change. Record environment checks separately from code completion.
