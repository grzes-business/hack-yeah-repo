# Project context: Voice-First Personal Health Evidence Engine

## Product thesis

This is a hackathon sport and healthcare project for making better decisions about health, physical activity, and wellbeing by connecting training records, daily habits, wellbeing observations, and healthcare data. It should help a person understand what may be happening and choose a useful next step, rather than merely display measurements.

> Wearables tell you what happened. We investigate why.

Passive sensing (initially Apple Watch / Apple Health measurements such as sleep, HRV, resting heart rate, activity, and workouts) is combined with active conversational sensing. A person can tell the voice assistant about energy, stress, soreness, alcohol, caffeine, illness, pain, workout effort, and other predefined observations that wearables cannot see. **Voice is another sensor.** Together these sources form a Personal Evidence Model.

This is not another health dashboard or readiness score, “ChatGPT connected to Apple Health,” generic AI health coach, or an LLM speculating about metric relationships.

The **Personal Evidence Model** is the user's normalized observations, derived daily history, predefined relationships evaluated against that history, and known gaps in relevant context. It is a product/domain concept, not a trained machine-learning model or a language model's memory. An investigation can remain inconclusive; identifying a useful missing observation is itself a useful next step.

## How to read this documentation

This file owns shared product meaning and non-negotiable principles. Read it first, then use the reference matching the task. Supporting docs elaborate this context; they must not silently redefine it.

| Document | What it owns |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Agent routing, repository conventions, and change workflow. |
| [Roadmap](docs/ROADMAP.md) | Stages, dependencies, boundaries, completion criteria, and issue scaffold. |
| [Architecture](docs/ARCHITECTURE.md) | Current versus target layers, persistence, integration, and open decisions. |
| [Persistence](docs/PERSISTENCE.md) | Hosted migrations, demo identity, access/validation boundaries, and repository behavior. |
| [Domain](docs/DOMAIN.md) | Registry vocabulary, record semantics, missingness, modes, Stage 0 requirements. |
| [Conversation](docs/CONVERSATION.md) | Extraction, controlled questions, active sensing, failure semantics. |
| [Evidence](docs/EVIDENCE.md) | Analytical responsibilities, bundle contents, interpretation rules. |
| [Fixtures](docs/FIXTURES.md) | Implemented sample history, planted patterns/gaps, identity/retry/removal, and validation. |
| [Demo](docs/DEMO.md) | User story, screen responsibilities, demonstration milestones. |

**Agreed constraints** are requirements from the product context; **candidate examples** express its original direction; **open decisions** identify choices a later stage must settle. No example is a finalized schema, statistical threshold, or existing feature.

## Trust and evidence rule

> **AI can communicate evidence; AI cannot create evidence.**

The LLM can hold a natural conversation, understand speech, phrase an application-selected question, map speech into known event types, and explain a structured result. It cannot define metrics or events, invent relationships, calculate or claim evidence, or assert causation. Deterministic application code and validated schemas own accepted variables, relationship rules, baselines, anomalies, statistics, sample sizes, evidence classifications, and experiment results.

Unmapped speech remains an unstructured note or returns a clear `unrecognized` / `nothing_trackable` result. Ambiguity can return `needs_clarification`. The model must never create a new health variable to fit an utterance.

## Domain concepts

- **Metric Registry:** a deliberately small initial set (about 8–12) of objective, unit-aware measurements. Examples: HRV, resting heart rate, sleep duration/start/end, steps, active energy, workout duration, and workout average heart rate. Add other HealthKit types only when the product needs them.
- **Subjective Event Registry:** predefined conversational observations such as energy, stress, mood, soreness, alcohol, caffeine, late meal, illness, pain, and workout RPE. Values and provenance must be validated.
- **Relationship Registry:** the allow-list of relationships analytics may test. Each entry defines factor, outcome, temporal lag, method (for example Spearman or exposure comparison), and where useful known confounders. The LLM cannot add edges.
- **Agent modes:** explicit responsibilities, not one omnipotent agent: `capture`, `morning_checkin`, `post_workout`, `investigate`, `experiment`, and `doctor_prep`. Start with capture and morning check-in; add investigation, then experiment, as stages allow.
- **Core records:** `MetricSample` is a normalized raw objective observation; `SubjectiveEvent` is a validated conversational observation with timestamp and provenance; `DailyFeatures` is a derived daily analytical view; `EvidenceBundle` is the structured output of deterministic investigation. Raw observations remain distinct from derived features.
- **HealthDataSource:** `getSamples({ from, to, metrics }): Promise<MetricSample[]>`. Mock and Apple Health adapters implement the same contract so downstream code does not know the source.

## Product and architecture boundaries

The existing application is a Next.js App Router + TypeScript + Supabase starter with Vercel deployment conventions. It contains Stage 0 contracts, the Stage 1 product shell/typed persistence, and Stage 2 mock history/ingestion. Product pipelines remain later work; hosted activation is tracked separately in [Persistence](docs/PERSISTENCE.md). Conceptually, the planned web app contains Today, Talk, Evidence, and Timeline experiences; server/backend logic handles conversation and health ingestion, validation, persistence, daily feature building, analytics, and evidence investigation. Supabase will store raw observations, conversation provenance, derived features, relationship results, and later experiment data.

GPT-Live handles real-time conversation. Canonical event extraction is a separate backend pipeline: transcript/turn → extraction into predefined types → schema validation → persistence. The application selects *what* to ask; GPT can choose *how* to phrase it. For investigation, the model requests a deterministic outcome investigation and receives a structured `EvidenceBundle`; it does not inspect raw data to invent a theory.

Analytics should begin with understandable deterministic methods, not machine learning: personal rolling baselines (robust statistics where appropriate), anomaly detection, Spearman relationships for continuous factors, exposure/control comparisons for categorical factors, explicit lags, sample sizes, effect sizes, and conservative product evidence labels. Labels such as `INSUFFICIENT_DATA`, `WEAK_SIGNAL`, `POSSIBLE_ASSOCIATION`, and `CONSISTENT_ASSOCIATION` describe product evidence, not medical causality. State limitations and plausible confounders.

`MockHealthDataSource` is a permanent first-class source for development, fixtures, demo fallback, and analytics validation. Generate realistic history (roughly 45–60 days) with intentional relationships, such as short sleep followed by lower energy or alcohol followed by lower HRV, so the analytics pipeline can be checked against known patterns.

Capacitor/iOS/HealthKit are deliberately late. Native work owns permissions, queries, and normalization inside `AppleHealthDataSource`; web/backend work owns schemas, Supabase, conversation, analytics, and UI. The shared integration seam is `HealthDataSource` and normalized samples. The rest of the product must not depend on HealthKit details.

## Evidence loop and demo narrative

The product's differentiating loop is:

1. Passive and conversational inputs reveal an unusual outcome.
2. Deterministic investigation compares it with the user's baseline and allowed historical relationships.
3. The system identifies relevant context that is still unknown.
4. Application logic selects one useful question; GPT phrases it naturally.
5. The answer is validated and saved as a structured observation with provenance.
6. Investigation runs again and the UI shows how the evidence changed.

Hackathon demo: show an unusual metric (for example, low HRV) alongside personal baseline and recent observations; show what known factors do and do not explain it; ask about missing context such as illness, stress, or alcohol; capture the answer; then show the updated evidence with sample size and uncertainty. Avoid a generic score and never imply that an association proves a cause.

## Non-goals and constraints

- No free-form LLM diagnosis, causal inference, or medical advice presented as fact.
- No dynamically invented metrics, event types, or relationships; no support for every HealthKit datatype at the outset.
- No machine-learning-first analytics or opaque readiness score.
- No HealthKit dependency for early development; mock data must exercise the same downstream path.
- Keep Supabase relatively boring: raw samples, subjective events, conversations/turns, daily features, relationship results, and later experiments/observations. Preserve provenance and separate raw from derived data.
- Keep domain contracts independent of Next.js, Supabase, GPT, and HealthKit where practical; their definitions belong in Stage 0.

## Current scope

Stage 0 is implemented: the nine metrics, ten event types, four allowed relationships, lowercase agent modes, reusable Zod schemas, and health-source contract are defined. [DOMAIN.md](docs/DOMAIN.md) records canonical units, 0–10 scales, wake-date sleep, temporal lags, missingness, provenance, and schema usage. This is a contract foundation; feature building, statistics, voice, and native adapters remain later stages. Stage 1 storage and shell acceptance checks pass; hosted migrations and anonymous Auth are active. Stage 2 supplies repeatable objective and subjective fixtures with sample loading/removal and validated ingestion. See [FIXTURES.md](docs/FIXTURES.md); feature building and evidence generation remain later work.

Stage -1 establishes shared understanding and agent routing only. It does not implement registries, schemas, database migrations, voice features, analytics, or native integrations. Follow [`docs/ROADMAP.md`](docs/ROADMAP.md) for later stage boundaries and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the intended data flow.

Stage -1 is complete when a new agent can explain the thesis and evidence boundary, locate domain/integration rules, distinguish current code from intended features, find each later stage's scope, and turn that stage into an issue without reinventing the architecture. The documentation is versioned project knowledge and should evolve with explicit decisions.
