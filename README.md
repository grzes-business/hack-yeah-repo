# Personal Evidence

Next.js (App Router, TypeScript) with Supabase for Postgres, Auth, and Storage, deployed on Vercel. Today, Talk, Evidence, and Timeline form the initial app shell. `/status` retains the starter deployment/configuration diagnostics.

## Health-app project documentation

This starter is the foundation for a Voice-First Personal Health Evidence Engine. Stages -1 through 2 are implemented and verified. Hosted migrations and anonymous Auth are active. Follow [docs/PERSISTENCE.md](docs/PERSISTENCE.md) for migration and anonymous demo setup. Product pipelines follow the staged roadmap.

Start with [CONTEXT.md](CONTEXT.md) for the product thesis and evidence constraints. Coding agents should enter through [AGENTS.md](AGENTS.md), which routes tasks to domain, architecture, conversation, evidence, and demo guidance. See [docs/ROADMAP.md](docs/ROADMAP.md) for Stage 0 onward and the future GitHub issue scaffold. Use [docs/stages/README.md](docs/stages/README.md) for self-contained implementation guides and explicit acceptance criteria for every stage (-1 through 14). Stage 3 voice is implemented with live acceptance pending; later guides remain specifications. The setup instructions below describe the existing starter.

## Prerequisites

- Node.js 20.9 or newer
- pnpm (`corepack enable` or `npm i -g pnpm`)
- A Supabase project (optional for the first page, required for any database, auth, or storage work)
- A Vercel account (only for deployment)

## Local startup

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The app runs without any Supabase credentials. Product pages show a setup message; `/status` shows "Local development" and "Not configured".

Other commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build (run this before deploying) |
| `pnpm start` | Serve the production build locally |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run contract, fixture, ingestion, and repository tests |
| `pnpm verify:hosted` | Opt-in live acceptance checks; creates disposable anonymous Auth accounts and cleans their test records |
| `pnpm typecheck` | TypeScript check (run build first on a fresh checkout to generate Next.js types) |

## Supabase setup

1. Create a project at https://supabase.com/dashboard.
2. Open **Project Settings > API**. Copy the **Project URL** and the **Publishable key**.
3. Create a local env file:

   ```bash
   cp .env.example .env.local
   ```

4. Replace the placeholder values in `.env.local` with the values from step 2.
5. Follow [hosted database/demo setup](docs/PERSISTENCE.md#hosted-setup), then restart `pnpm dev`. Configuration presence on `/status` is not a database-health check.

Client code lives in `lib/supabase.ts`. Use `createSupabaseClient()` from server or client code. It returns `null` when the credentials are missing, so check for that or call `isSupabaseConfigured()` first. Auth and repository operations contact Supabase as needed; `/status` checks configuration presence only.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | For Supabase features | Project URL, e.g. `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For Supabase features | Publishable (public) key |

Both variables are exposed to the browser by design. Never add a secret or service role key with the `NEXT_PUBLIC_` prefix. Secrets belong in server-only variables without that prefix.

`.env*` files are git-ignored except `.env.example`. Do not commit `.env.local`.

`VERCEL_ENV` is set by Vercel and read by the app to tell environments apart (`production`, `preview`, or unset for local). Do not set it yourself.

## Deploy on Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New > Project**, import the repository, and keep the defaults. Vercel detects Next.js and pnpm from the lockfile.
3. Under **Settings > Environment Variables**, add both `NEXT_PUBLIC_SUPABASE_*` variables for the environments you need (Preview and/or Production).
4. Deploy. Every pull request or non-production branch gets a preview URL, and pushes to the production branch (usually `main`) deploy to production.
5. After changing environment variables, redeploy. Variables are baked in at build time.

Check `/status` at the deployed URL: the deployment card should read "Vercel preview" or "Vercel production", and the Supabase card should match your configuration.

## Project layout

```
app/
  layout.tsx        Root layout and metadata
  (product)/        Today, Talk, Evidence, Timeline and session shell
  components/       Browser session, navigation, profile settings
  status/page.tsx   Environment and Supabase configuration presence
  globals.css       Global styles
lib/
  deployment.ts     getDeploymentEnvironment(): local | preview | production
  supabase.ts       Typed client; null without credentials
  domain/           Stage 0 contracts
  db/               Typed ownership, validated batches, paginated range reads
  demo/             Scenario, separate subjective fixtures, seed orchestration
  health/           HealthDataSource contract
supabase/migrations/ Hosted SQL migrations
.env.example        Variable names with placeholder values
```

After starting a demo session, choose **Load sample history** on Today, then inspect Timeline. The records are fictional and explicitly labeled. See [docs/FIXTURES.md](docs/FIXTURES.md) for the 56-day recipe, planted patterns, gaps, and safe removal/retry behavior.

Add new routes under `app/`, shared helpers under `lib/`. See `AGENTS.md` for conventions.

## Live voice (Stage 3)

Add the server-only `OPENAI_API_KEY` to `.env.local`, restart the app, start a private demo session, and open `/talk`. Optional `OPENAI_REALTIME_MODEL` defaults to `gpt-realtime-2.1`. The provider account needs API billing and model access; ChatGPT subscription usage does not configure this API key. Never expose the key through `NEXT_PUBLIC_`. See [VOICE](docs/VOICE.md) for transcript/retry policies and pending acceptance checks.

## Structured capture (Stage 4)

Saved user turns on Talk now produce validated observations with visible save or clarification status. Explicit correction/clarification is available under the original turn. The same server API key is reused; optional `OPENAI_EXTRACTION_MODEL` defaults to `gpt-4.1-mini`. The third hosted migration is applied. See [CAPTURE](docs/CAPTURE.md) for replay, time, correction, and pending acceptance checks.
