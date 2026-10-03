# Domain vocabulary and contract requirements

Stage 0 turns these concepts into registries and validated types. The requirements preserve the original project direction; example keys and fields illustrate it rather than freeze schemas. Resolve the open choices before dependent stages implement them.

## Metric Registry

Objective measurements accepted from `HealthDataSource`. Begin with about 8–12 metrics rather than every HealthKit type.

| Candidate key | Meaning | Contract question to resolve |
| --- | --- | --- |
| `hrv` | Heart-rate variability | Measurement definition and canonical unit; avoid mixing incompatible HRV measures. |
| `resting_hr` | Resting heart rate | Unit and daily selection/aggregation. |
| `sleep_duration` | Duration of sleep | Minutes versus hours; session and day assignment. |
| `sleep_start`, `sleep_end` | Sleep interval boundaries | Timestamp representation and overnight alignment. |
| `steps` | Step count | Interval totals and overlapping-source behavior. |
| `active_energy` | Active energy expenditure | Canonical unit and interval aggregation. |
| `workout_duration` | Workout length | Session identity and duration unit. |
| `workout_avg_hr` | Workout average heart rate | Workout association and aggregation across sessions. |

Later candidates include respiratory rate, SpO2, wrist temperature, VO2 max, distance, workout type/energy, and sleep stages. Their appearance in the idea does not put them in initial scope. Each supported entry should define identity, meaning, accepted value/unit, source expectations, and aggregation semantics.

## Subjective Event Registry

Structured observations extracted from what the user actually reported.

| Candidate key | Meaning | Contract question to resolve |
| --- | --- | --- |
| `energy`, `stress`, `mood`, `soreness` | Self-reported state | Scale, anchors, range, and valid time window. |
| `alcohol` | Reported consumption | Quantity/unit and occurrence time; do not assume every beer is an equivalent standard drink. |
| `caffeine` | Reported intake | Amount, unit, timing, and unknown dose. |
| `late_meal` | Reported late eating | User report versus a defined time threshold. |
| `illness` | Reported symptoms or illness state | Distinguish reported symptoms from a diagnosis. |
| `pain` | Reported pain | Location, intensity, and optional context. |
| `workout_rpe` | Perceived workout effort | Scale and association with a workout/session. |

Unsupported statements remain notes or return `nothing_trackable`; ambiguous supported statements can return `needs_clarification`. Extraction confidence concerns interpretation of speech. It is not statistical evidence strength or certainty that an explanation is correct.

## Relationship Registry

An allow-list of factors and outcomes the deterministic engine may evaluate. Each entry needs a stable identity, defined factor/outcome, lag, method, and relevant known confounders. Examples from the original context:

| Factor | Outcome | Illustrative lag | Method |
| --- | --- | --- | --- |
| Sleep duration | Energy | 1 day | Spearman |
| Alcohol | HRV | 1 day | Exposure/control comparison |
| Stress | Sleep duration | Same day | Spearman |
| Workout RPE | Energy | 1 day | Spearman |

Arrows express candidate associations, not causes. Stage 0 must settle daily alignment before encoding lags: assigning overnight sleep to its wake date changes what “next-day energy” means. Do not encode “next day” in an outcome key and then shift it a second time with `lagDays`.

Training load, sleep efficiency, sleep onset, and caffeine timing appear in the conceptual graph but require explicit feature definitions and available inputs before activation. The LLM cannot introduce them opportunistically. Naming a confounder does not mean the engine statistically adjusted for it.

## Records and provenance

| Concept | Responsibility | Required meaning |
| --- | --- | --- |
| `MetricSample` | Raw normalized objective observation | Registered metric, value/unit, time interval, source/device, external identity where available. |
| `SubjectiveEvent` | Validated user observation | Registered event type, typed value/properties, occurrence time, source conversation turn. |
| Conversation / turn | Conversation provenance | Session identity, speaker, transcript, timestamp; one turn can yield several events. |
| `DailyFeatures` | Derived analytical representation | User/date, defined aggregations, missingness, links to input observations. |
| Relationship result | Calculated personal association | Identity, evaluated period/lag, sample counts, method, effect, label, limitations. |
| `EvidenceBundle` | Investigation facts for UI/explanation | Outcome/date, observations, anomalies, relationships, missing factors, caveats. |
| Experiment / observation | Later personal experiment | Proposal, periods/outcomes, eligibility/confounders, collected observations. |

Distinguish occurrence time from capture time. “Yesterday” refers to the user's temporal context, not an assumed server timezone. Retain enough provenance to inspect the original statement and rebuild outputs after corrections. Exact fields/table definitions remain Stage 0/1 decisions.

## Missingness and validation

- Unknown differs from explicit zero or false. Unanswered alcohol is not “no alcohol”; missing energy is not zero energy.
- Missing device samples do not prove an activity did not occur. Permission denial and empty results cannot justify a negative observation.
- Validate registry identifiers, value types/ranges, units, temporal fields, and provenance before analytics.
- Do not invent dates, quantities, or symptom details to fit a schema. Clarify or preserve partial information only when the contract supports it.
- Rebuilding derived records must not silently rewrite raw observations.

## Agent modes

`AgentMode` denotes a product conversation mode, not coding agents working in this repository.

| Mode | Role | Introduction |
| --- | --- | --- |
| `capture` | Speech mapped to predefined events | Stage 3 voice; Stage 4 extraction |
| `morning_checkin` | Controlled questions on energy, soreness, mood, illness | Stage 5 |
| `post_workout` | Structured workout interview | Future extension; no dedicated stage yet |
| `investigate` | Request and explain deterministic evidence | Stage 8; extended in Stage 9 |
| `experiment` | N-of-1 proposals and observations | Stage 14 |
| `doctor_prep` | Future preparation mode | Deferred; no defined behavior/stage |

Uppercase labels such as `CAPTURE` in the roadmap describe these modes conceptually. Stage 0 chooses one serialized representation consistently.

## HealthDataSource

The original conceptual contract is:

```typescript
interface HealthDataSource {
  getSamples(args: {
    from: Date;
    to: Date;
    metrics: Metric[];
  }): Promise<MetricSample[]>;
}
```

Stage 0 defines types, range semantics, and validation. Native date serialization belongs in the adapter. Mock and Apple sources must satisfy the same semantic contract. Subjective mock history needs an explicit fixture/seeding path: this interface returns objective samples, not subjective events.

## Stage 0 decisions

Record registry scope, units/scales, timestamp/range conventions, sleep/day alignment, partial values, extraction outcome shape, provenance identifiers, and initial relationships. Define feature eligibility. Zod is the original validation preference, not an installed dependency today. Evidence thresholds belong to Stage 7, not implicit schema defaults.

See [architecture](ARCHITECTURE.md), [conversation](CONVERSATION.md), and [evidence](EVIDENCE.md).
