# Persistence and demo sessions (Stage 1)

Stage 1 adds a browser-session application shell, a seven-table migration, and typed, user-scoped repository access. The migration was applied to the hosted project on 2026-10-03. A database inventory confirmed all seven tables with RLS enabled, four owner policies on each raw/profile table, and one owner read policy on each derived table. Anonymous sign-in was enabled with user approval on 2026-10-03 and confirmed still enabled after reloading the hosted settings page. Stage 1 acceptance checks passed on 2026-10-03: anonymous sign-in and profile saving/restoration in the browser; owned raw reads/writes, cross-user read/write denial, composite provenance checks, derived write denial, and unauthenticated denial against hosted Supabase. Missing-credential production build/render also passed. This document must record those separately from implementation completion.

## Hosted setup

For the current project both SQL migrations are applied; do not run the creation migration again. Anonymous Auth is enabled. The steps below also document fresh-project setup.

1. Keep the existing public URL/publishable key in `.env.local`; restart development after changes. Never commit credentials.
2. In the hosted project's SQL Editor, inspect existing `public` tables, then apply migrations under `supabase/migrations/` in filename order once. Stage 1 creates all seven tables in one transaction and deliberately fails on conflicting table names. Stage 2 adds checked/indexed metric interval starts. Reconcile conflicts with a new migration; do not drop existing user data.
3. Enable **Anonymous Sign-Ins** in Supabase Authentication settings if disabled. Anonymous Auth users have unique IDs and the `authenticated` database role; the unauthenticated `anon` role has no access to these tables. See [Supabase's anonymous Auth guide](https://supabase.com/docs/guides/auth/auth-anonymous).
4. Start the app and choose **Start demo**. A persisted browser session is created; the profile records the browser's IANA time zone. Save a name/time zone on Today to exercise profile persistence.
5. This manual SQL Editor application does not populate a Supabase CLI migration ledger. If you later link the CLI, reconcile the applied migration history before running `db push`; do not replay this creation migration against existing tables.
6. Confirm the session restores on reload, and the Timeline shows an empty state before ingestion. Use two separate browser profiles to check ownership: each should see only its own rows. Verify cross-user writes and cross-user conversation references are rejected, and browser writes to derived tables are denied before declaring hosted setup complete.

The status page at `/status` reports configuration presence and deployment environment only. It has no session provider or database queries. Public product pages build/render without credentials; auth/profile queries run after browser mounting.

No local PostgreSQL service, database, Docker container, or standalone database setup is required or created.

## Identity and storage

| Table | Record / identity | Access and purpose |
| --- | --- | --- |
| `profiles` | Auth UUID `user_id` | Owner name/time zone; created lazily and never overwritten by session restoration. |
| `conversations` | `(user_id, id)` | Mode and session interval. Mode vocabulary does not activate later features. |
| `conversation_turns` | `(user_id, id)` | User/assistant transcript, session reference, occurrence time. |
| `metric_samples` | `(user_id, id)` | Canonical `MetricSample` JSON; indexed measurement time, metric/source/external identity. |
| `subjective_events` | `(user_id, id)` | Canonical `SubjectiveEvent` JSON with a required conversation-turn reference. |
| `daily_features` | `(user_id, date, time_zone, builder_version)` | Canonical derived daily view; multiple builder versions can coexist. |
| `relationship_results` | `(user_id, relationship_id, period_from, period_to, analysis_version)` | Canonical versioned analysis results. |

Domain IDs remain opaque text; only user ownership uses Supabase Auth UUIDs. Composite foreign keys prevent a turn from linking to another user's conversation, or an event from linking to another user's turn. Deleting an Auth user cascades its records; deleting a conversation cascades its turns/events. There is no account deletion/reset UI yet.

Canonical payloads preserve Stage 0 UTC strings, structured values, explicit unknown states, source metadata, and provenance without inventing a second domain model. Relational metadata used for identity/querying must match the payload; generated columns extract registry/source keys. PostgreSQL `timestamptz` is used for chronological indexes, so fractional timestamps sort correctly. The repository normalizes relational conversation timestamps back to UTC ISO strings on reads.

## Validation and access boundary

- `lib/db/database.types.ts` is a hand-maintained schema snapshot for this migration, not proof of a deployed schema. Regenerate/reconcile it using Supabase tooling after deployment; include generated relationship metadata when introducing joins.
- `lib/db/records.ts` defines persistence-only profile/conversation/turn validation. Domain contracts stay in `lib/domain/`.
- `lib/db/repository.ts` verifies `auth.getUser()` on each operation and obtains ownership from the verified session. Callers cannot supply a user ID. Queries also explicitly filter ownership; RLS is the database enforcement layer.
- Stage 1 uses browser-persisted Supabase Auth sessions, not an SSR cookie integration. Future backend routes must verify the supplied user token and scope server writes themselves; calling the public client factory on the server does not inherit the browser session.
- Raw write methods validate with Stage 0 schemas. Reads validate payloads and check relational identity, owner, and metadata before returning canonical records. Invalid storage yields an error, never a silent repaired value.
- All seven tables use owner-scoped SELECT policies. Only profiles, conversations, turns, metrics, and events grant owner CRUD. Derived tables grant no browser writes; future deterministic backend builders use a server-only writer with verified request ownership. No model gets a writer key.
- Database checks enforce ownership, references, registry IDs, metric units, and payload/index metadata consistency. They do **not** duplicate every Zod constraint. A direct authenticated REST write could put malformed raw JSON in its owner's rows; schema validation rejects it when read. Add server ingestion and stronger database constraints where needed in subsequent stages. RLS establishes isolation, not scientific validity.

Raw upserts use `(user_id, id)` and preserve the caller's canonical ID. The additional unique source identity `(user_id, source_type, external_id, metric)` rejects the same external observation under a different ID. Stage 2 defines stable mock IDs and replay semantics in [Fixtures](FIXTURES.md); Stage 13 owns real source overlap. Upserting altered records does not currently invalidate/rebuild derived data; Stage 6 must own that lifecycle before analytics ships.

Shell reads are bounded (100 conversations/derived records, 500 turns per conversation, latest 500 metric samples and 500 events). Stage 2 adds paginated `readMetricSamples()` and `readSubjectiveEvents()` for complete requested ranges; analytics must use those rather than truncated UI reads. No derived writer or algorithms are implemented in Stage 1.

## Demo lifecycle and remaining work

One-click anonymous Auth is the agreed hackathon flow. The session is retained in that browser; clearing its storage loses access to the anonymous account. The UI states this before sign-in. Use sample information for demos; account linking/recovery, reset/deletion, production abuse protection, and retention policies need explicit later work before production use.

Today persists profile settings. Talk now implements live voice and structured capture; Evidence remains a future capability. Timeline loads validated saved raw observations and distinguishes demo samples from Apple Health and conversation inputs. Stage 2 adds clearly labeled sample history and owner-scoped removal; see [Fixtures](FIXTURES.md). The app stores voice transcripts rather than audio recordings; analytical results and native adapters remain later work.

Hosted setup is complete only after migration application, anonymous sign-in, profile read/write, and user isolation have been checked against the actual project. Record the result here and in the roadmap when that happens.

## Stage 4 extraction persistence

`202610030003_turn_extractions.sql` was applied successfully to hosted Supabase via SQL Editor on 2026-10-03. Do not reapply it; the manual migration ledger still needs reconciliation before CLI pushes. This adds the eighth table, owner-readable `turn_extractions`, and authenticated owner-scoped claim/finish/release RPCs for atomic capture/replacement and replay. Direct table writes are denied; RPCs explicitly derive `auth.uid()`. Existing raw/derived permissions remain unchanged. Read [CAPTURE](CAPTURE.md) for leases, immutable-root expectations, audit snapshots, correction semantics, the direct-RPC trust limit, and pending behavioral acceptance. The hand-maintained database type snapshot includes all three migrations.
