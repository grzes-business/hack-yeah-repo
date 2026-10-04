<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent entry point

Read these in order before changing product behavior:

1. [`CONTEXT.md`](CONTEXT.md) — canonical product thesis, domain vocabulary, architecture boundaries, and invariants.
2. [`docs/ROADMAP.md`](docs/ROADMAP.md) — read the stage relevant to your task and its prerequisites.
3. Read [`docs/stages/README.md`](docs/stages/README.md) and the relevant stage guide — implementation work, dependencies, decisions, acceptance criteria, verification, and handoff.
4. Read the focused references below for the affected boundary.
5. Read the repo-specific rules here and inspect the existing code before editing it.

| Working on | Read |
| --- | --- |
| Structure, storage, native/web seam | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); storage/auth also [`docs/PERSISTENCE.md`](docs/PERSISTENCE.md) |
| Registries, schemas, time/value semantics | [`docs/DOMAIN.md`](docs/DOMAIN.md) |
| Voice, extraction, check-ins, question selection | [`docs/CONVERSATION.md`](docs/CONVERSATION.md) and domain |
| Features, analytics, investigation, experiments | [`docs/EVIDENCE.md`](docs/EVIDENCE.md), [`docs/DAILY-FEATURES.md`](docs/DAILY-FEATURES.md), domain, and architecture |
| Product UI or demo fixtures | [`docs/DEMO.md`](docs/DEMO.md), [`docs/FIXTURES.md`](docs/FIXTURES.md), and relevant domain/evidence rules |

For a change, read the relevant section(s) above and the code it touches. If a future domain contract document is added, link it from `CONTEXT.md` and update this reading path.

## Non-negotiable product constraints

- **AI can communicate evidence; AI cannot create evidence.** Deterministic, validated code defines accepted variables and relationships and calculates baselines, anomalies, comparisons, sample sizes, evidence labels, and experiment results. The model may converse, phrase application-selected questions, extract into predefined schemas, and explain structured evidence.
- The model must not invent metrics, subjective event types, relationship edges, statistical results, or causal claims. Unknown speech stays unstructured or is marked not trackable / needing clarification.
- Keep raw observations separate from derived daily features and evidence. Preserve source and conversation provenance.
- Every investigated relationship is predefined and specifies its temporal lag and method. Report associations as associations, with uncertainty and sample size.
- Mock data is a first-class source for development, demos, and analytics validation. HealthKit is a later adapter, not a prerequisite for product logic.
- Unknown values must stay unknown; absence of a report/sample is not zero or false. Every numerical explanation must trace to deterministic evidence.
- Keep HealthKit and Capacitor details behind `HealthDataSource`; web/backend and native integration meet at normalized `MetricSample[]`.
- Do not implement a later roadmap stage while working on an earlier stage unless the user explicitly changes scope. Treat roadmap entries as direction, not already-approved implementation details.

## Repository rules

- Stack: Next.js App Router, TypeScript, React 19, Supabase Postgres/Auth/Storage via `@supabase/supabase-js`, deployed on Vercel; use pnpm.
- Shared helpers belong in `lib/`; routes belong in `app/`. Keep the starter small and add dependencies only when a feature needs them.
- Create Supabase clients with `createSupabaseClient()` from `lib/supabase.ts`. It returns `null` without credentials. The app must build and render without Supabase credentials; do not query the database on the status page or during build.
- Supabase uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; voice additionally uses server-only `OPENAI_API_KEY` and optional `OPENAI_REALTIME_MODEL`. Never commit `.env*` files except `.env.example`; never expose service-role keys or other secrets with a `NEXT_PUBLIC_` prefix.
- Use `getDeploymentEnvironment()` from `lib/deployment.ts` for Vercel environment detection. Vercel environment-variable changes require a redeploy.
- Preserve the existing Next.js/Supabase setup. Do not add Drizzle, Prisma, or another ORM.
- Before code changes, follow the generated Next.js rules at the top of this file and inspect the relevant installed Next.js guide. Keep documentation-only work independent of app changes.

### Commands

- `pnpm install` — dependencies; `pnpm dev` — local server; `pnpm start` — production server.
- `pnpm build` — production build; must pass before merging application changes.
- `pnpm lint` — ESLint for `app` and `lib`.
- `pnpm test` — compile and run domain/source/fixture/persistence tests with Node's built-in runner.
- `pnpm verify:hosted` — opt-in live acceptance checks; creates two disposable anonymous Auth users, removes their test records, and leaves the Auth accounts.
- `pnpm typecheck` — TypeScript check; run after `pnpm build` on a fresh checkout so Next.js route types exist.

See [`README.md`](README.md) for startup, environment variables, and deployment instructions.

## Working and documentation conventions

- The historical voice acceptance checklist is [Stage 4.5 — Voice reliability](docs/stages/stage-04a-voice-reliability.md), and remains relevant to later voice changes. The owner authorized onward delivery with manual walkthroughs deferred; do not treat that checklist as an implicit implementation block. It owns deliberate turn-taking, capture-result feedback, spoken clarification/correction, grounded saved-report retrieval, communication, and live acceptance. Its controller is implemented; live interpretation failures and physical acceptance remain unresolved. Future tools must be explicitly authorized and server-validated; the current live session still has no tools.

- Stage 3 capture-only WebRTC and transcript persistence are implemented, with live acceptance pending. Read [VOICE](docs/VOICE.md) before changes. Preserve server-verified ownership, final-turn IDs, save-status/recovery semantics, resource cleanup, and the absence of health/tool dispatch in the live model. Stage 4 adds a separate app-owned extraction pipeline; read [CAPTURE](docs/CAPTURE.md) before capture/storage changes. Preserve all-or-clarify, application-owned dates/provenance, lease/revision replay, atomic correction, and the documented RPC trust boundary.

- Before changing an architectural boundary, check `CONTEXT.md` and `docs/ARCHITECTURE.md`; update those docs in the same change if the agreed design changes.
- Keep product behavior in code aligned with the registries and schemas defined during Stage 0. Do not quietly create an alternate source of truth.
- Stage 1 implementation provides `lib/db/`, the hosted migration under `supabase/migrations/`, and the product shell. Read `docs/PERSISTENCE.md` before storage/auth changes. The hosted migration is applied and anonymous Auth is enabled. Stage 1 browser, hosted ownership/provenance, and missing-credential acceptance checks passed; persistence guidance records the checks. Derived tables are read-only for browser users.
- Stage 2 is implemented. Read `docs/FIXTURES.md` for sample identity, gaps, separate subjective fixture provenance, batch failures/retry, and removal. Use `ingestHealthData()` for canonical source ingestion and paginated repository range reads for full history. Never impute fixture gaps from scenario ground truth or turn generating formulas into user evidence.
- Stage 0 is implemented. Import contracts from `@/lib/domain` and the source interface from `@/lib/health/data-source`. Read `docs/DOMAIN.md` for the frozen version 1 choices. Unknown values are explicit states; missing-factor context includes a date and registry-defined lag. Model extraction uses draft schemas; application code supplies accepted-event ownership/provenance fields.
- Future stage issues should link to `CONTEXT.md`, the relevant `docs/stages/` guide and its AC IDs, and the relevant roadmap/architecture section, state their stage and outcome, list in-scope work and acceptance criteria, and identify dependencies. Keep umbrella issues concise; put detailed implementation contracts in versioned docs when they become stable.
- For new domain/architecture docs, add a link here or in `CONTEXT.md` so agents can find them. Prefer updating an existing canonical doc over duplicating rules.
- State the stage, intended outcome, and affected boundaries before implementing. Identify existing work so a stage does not rebuild the starter.
- Resolve an open decision in its owning document when implementation needs it. Do not silently treat illustrative values, schemas, or methods as finalized contracts. Ask the user when a choice changes product scope or an agreed constraint; routine implementation choices can be documented and made within the task.
- Validate the changed behavior at its boundary. Report checks actually performed and known limitations. For documentation-only work, check links, consistency, and changed-file scope; application tests are not needed merely because docs changed.
- Keep `CLAUDE.md` pointing to this file as the shared routing source.

## Stage 6 implementation checkpoint

Stage 5 and Stage 6 are implemented with behavioral/live acceptance pending; earlier acceptance notes remain dated. Before derived-data work, read [DAILY-FEATURES](docs/DAILY-FEATURES.md). Use pure builders and authenticated `/api/features` orchestration; never bypass generation freshness or mix synthetic/personal scopes. `SUPABASE_SERVICE_ROLE_KEY` is server-only and only the authenticated server writer may invoke the new derived commit. Hosted migration 007 is applied; do not reapply it. Stage 7 must verify generation on privileged reads/writes and use complete requested histories.

## Stage 7 checkpoint

Implementation is in `lib/analytics/`, `/api/analytics` and Evidence. Read [ANALYTICS](docs/ANALYTICS.md) before analytical changes. Preserve the four-edge graph, fixed windows, exact lags, deterministic labels, undefined-statistic nulls, personal/demo separation and generation checks. The owner deferred manual acceptance; static checks do not certify numerical/hosted ACs.

Hosted analytical migration 009 is applied; do not reapply it. Stage 7 static build/type/lint checks passed; numerical/live/security acceptance remains pending.

## Stage 8 checkpoint

Read [INVESTIGATION](docs/INVESTIGATION.md) before investigation/tool/explanation changes. `lib/investigation/`, `/api/investigate`, Evidence and app-owned voice dispatch implement outcome investigation. Preserve owner-derived requests, current generation/zone/policy, exact dated missing references, approved fact-only explanations and truthful provider fallback. Stage 9 selection/capture rules are documented in [ACTIVE-SENSING](docs/ACTIVE-SENSING.md). `pnpm verify:investigation` uses and cleans only disposable accounts.

Stage 8 checks: 73 tests plus live disposable-account API/provider/typed voice dispatch passed; build/lint/type checks passed. Stage 9 implementation is recorded below. Preserve the Stage 8 completion record and remaining physical audio limitations.

## Stage 9 checkpoint

Read [ACTIVE-SENSING](docs/ACTIVE-SENSING.md) before changing questions or question-answer dispatch. `questions-v1` owns deterministic dated targets; `/api/questions` derives owner, commits raw answers atomically and then refreshes evidence. Preserve single-question state, replay/source-turn guards, unknown semantics and personal/demo separation. Hosted migration 010 is applied; do not reapply. Physical voice/UI walkthrough remains manual.

Stage 9 checks: 81 unit tests and build/lint/type checks passed. Disposable-account hosted/provider/typed voice checks and Stage 8 regressions passed; current-scope before/after retains unchanged historical effects where expected. The Stage 9 guide contains an acceptance validation path before Stage 10, not a film script.

## Stage 10 checkpoint

Read [MOBILE-UI](docs/MOBILE-UI.md) before product or voice-mode changes. Stage 10A/B were authorized together. Talk/Today/Insights/History keep the existing route URLs. Normal reporting is voice-only; diagnostics are secondary. Explicit `VoiceTurnInput.context` and persisted server question context prevent unrelated/global question interception. Capture/check-in orchestration now lives in `lib/capture/server.ts` and `lib/checkin/server.ts`; API routes wrap those helpers. No new migrations. `pnpm verify:mobile` exercises disposable accounts on a dev server; physical phone/native audio remains separate.

## Stage 11–14 checkpoint

Read [HEALTHKIT](docs/HEALTHKIT.md) before shell, Capacitor, Apple Health or sync changes, and [EXPERIMENTS](docs/EXPERIMENTS.md) before experiment changes. The iOS shell loads the hosted app from `CAP_SERVER_URL` (`pnpm cap:sync`, then Run in Xcode); never bundle secrets or assume a static export. Never return or await a Capacitor plugin proxy from an async function. Day assignment treats metric interval ends as exclusive. Experiment results are recomputed on read and never stored; only templates bound to registered relationships may be offered. Migration 011 is written but must be applied by the owner in the hosted SQL Editor.
