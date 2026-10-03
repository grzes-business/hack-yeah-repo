# Hackathon starter

Next.js (App Router, TypeScript) with Supabase for Postgres, Auth, and Storage, deployed on Vercel. The home page shows whether the app is running locally, as a Vercel preview, or in production, and whether Supabase is configured.

## Health-app project documentation

This starter is the foundation for a Voice-First Personal Health Evidence Engine. Stage -1 establishes the documentation; product implementation follows the staged roadmap.

Start with [CONTEXT.md](CONTEXT.md) for the product thesis and evidence constraints. Coding agents should enter through [AGENTS.md](AGENTS.md), which routes tasks to domain, architecture, conversation, evidence, and demo guidance. See [docs/ROADMAP.md](docs/ROADMAP.md) for Stage 0 onward and the future GitHub issue scaffold. The setup instructions below describe the existing starter.

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

Open http://localhost:3000. The app runs without any Supabase credentials. The deployment card shows "Local development" and the Supabase card shows "Not configured".

Other commands:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build (run this before deploying) |
| `pnpm start` | Serve the production build locally |
| `pnpm lint` | Run ESLint |

## Supabase setup

1. Create a project at https://supabase.com/dashboard.
2. Open **Project Settings > API**. Copy the **Project URL** and the **Publishable key**.
3. Create a local env file:

   ```bash
   cp .env.example .env.local
   ```

4. Replace the placeholder values in `.env.local` with the values from step 2.
5. Restart `pnpm dev`. The Supabase card should now read "Configured".

Client code lives in `lib/supabase.ts`. Use `createSupabaseClient()` from server or client code. It returns `null` when the credentials are missing, so check for that or call `isSupabaseConfigured()` first. Creating the client makes no network request; only your queries do.

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

Check the deployed URL: the deployment card should read "Vercel preview" or "Vercel production", and the Supabase card should match your configuration.

## Project layout

```
app/
  layout.tsx        Root layout and metadata
  page.tsx          Home page with environment and Supabase status
  globals.css       Global styles
lib/
  deployment.ts     getDeploymentEnvironment(): local | preview | production
  supabase.ts       isSupabaseConfigured(), createSupabaseClient()
.env.example        Variable names with placeholder values
```

Add new routes under `app/`, shared helpers under `lib/`. See `AGENTS.md` for conventions.
