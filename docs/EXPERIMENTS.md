# Personal experiments (Stage 14) — `experiments-v1`

A user can opt into one predeclared observation plan per data scope and get a descriptive, provenance-backed before/after comparison. It is observation, not treatment: the app never changes behaviour on the user's behalf and never claims causation.

## Template

Only code-owned templates exist (`lib/experiments/contracts.ts`). v1 has one, bound to the registered `sleep_duration__energy` relationship (lag 0):

| Field | Value |
| --- | --- |
| Behaviour | Aim for ≥ 450 min (7.5 h) of recorded sleep each night |
| Periods | 14-day baseline immediately before a 14-day intervention |
| Primary outcome | `energy` daily feature (spoken rating 0–10) |
| Secondary outcome | `hrv` (SDNN ms) |
| Adherent day | Known `sleep_duration` ≥ 450 on that wake day; unknown sleep is never adherent |
| Minimum | 5 days with known energy in each group, else inconclusive |
| Method | `median_difference_descriptive`: intervention-adherent median − baseline median; relative difference uses the baseline median (null when 0) |
| Competing factors | Registry confounders: illness (same day), stress (same day), alcohol (previous day), workout RPE (previous day) |

The original "sleep ≥ 7.5 h over five workouts with workout RPE primary" example stays **unavailable**: RPE is not a registered outcome. The API schema rejects any other template.

## Lifecycle

`accepted → active ⇄ paused → completed | abandoned`. Personal plans start on the owner's local today and run forward. A synthetic demo plan ends today and is evaluated retrospectively over fictional sample history; it is labeled "Synthetic · retrospective" everywhere. Paused local dates (pause date up to the day before resume) are excluded. Every transition appends `{type, at, date}` to the event log; transitions are optimistic (`status` must be unchanged).

## Storage and trust

Migration `202610040011_experiments.sql` adds `experiments(user_id, id, scope, status, plan, events)` with owner-only **read** RLS, no browser write policies, and a unique index allowing one open plan per owner and scope. `/api/experiments` derives the owner from the verified token, builds the plan from the template and writes with the server-only writer. **Results are never stored**: every read rebuilds/reads current daily features (`baseline.from − 1` through the evaluated day) and recomputes `compareExperiment()` deterministically, so browsers cannot forge results and stale evidence is not served. History reset deletes plans.

## Result

`state`: `in_progress` (before the intervention end), `descriptive`, or `inconclusive`. The result reports counts (eligible, paused, sleep-known, adherent, missing sleep/energy), medians, differences, adherence rate, confounder counts per group, baseline nights already on target, and limitations. Explanations may restate these numbers only. Tests: `lib/experiments/experiments.test.ts`.
