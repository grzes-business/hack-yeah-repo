<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guidance

## Stack

- Next.js (App Router) with TypeScript, React 19
- Supabase for Postgres, Auth, and Storage, via `@supabase/supabase-js` only. Do not add Drizzle, Prisma, or another ORM.
- Deployed on Vercel. Package manager: pnpm (lockfile: `pnpm-lock.yaml`).

## Commands

- `pnpm install`: install dependencies
- `pnpm dev`: dev server at http://localhost:3000
- `pnpm build`: production build; must pass before merging
- `pnpm start`: serve the production build
- `pnpm lint`: ESLint

## Conventions

- Shared helpers go in `lib/`. Routes go in `app/`.
- Supabase: create clients with `createSupabaseClient()` from `lib/supabase.ts`. It returns `null` when credentials are missing, so the app must keep building and rendering without them. Do not query the database on the status page or during build.
- Environment: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are used. Never commit `.env*` files except `.env.example`. Never add service role keys or other secrets with a `NEXT_PUBLIC_` prefix.
- Deployment environment: use `getDeploymentEnvironment()` from `lib/deployment.ts`. It reads Vercel's `VERCEL_ENV`.
- Env var changes on Vercel take effect only after a redeploy.
- Keep the starter small. Add dependencies only when a feature needs them.
