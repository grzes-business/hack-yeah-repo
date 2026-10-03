# Deterministic evidence and investigation

**AI can communicate evidence; AI cannot create evidence.** These are analytical responsibilities and interpretation rules. Numerical examples are illustrative; windows, eligibility thresholds, and cutoffs must be settled in Stage 7.

## Daily features first

`buildDailyFeatures(userId, date)` combines normalized samples and validated events. `rebuildDailyFeatures(userId, range)` supports recomputation. Stage 6 defines day boundaries, overnight sleep assignment, aggregation, duplicate-source policy, missingness, and provenance. The same inputs/rules should produce the same features regardless of adapter.

Missing values stay missing. Training load and other derived variables need explicit formulas and eligible inputs. A daily row is not evidence by itself.

## Analytical modules

| Module | Responsibility | Limit |
| --- | --- | --- |
| Baseline | Compare the user with their historical distribution | Sparse history may not support a baseline. |
| Anomalies | Detect deviations under defined robust rules | An anomaly does not identify a cause. |
| Continuous relationships | Spearman association on eligible aligned pairs | Correlation is not causation. |
| Exposure comparisons | Compare exposed/control days with defined summaries/effects | Group sizes and competing factors affect interpretation. |
| Evidence classification | Reproducible rules for counts, effects, consistency | Labels are not medical certainty or causal probabilities. |
| Investigation | Assemble current state, relationships, missing context, limits | May remain inconclusive. |
| Experiments | Later descriptive personal-period comparisons | Proposals/results do not automatically establish causality. |

Original suggestions: 28-day rolling median, relative change `(current - baseline) / baseline`, robust z-score `0.6745 × (value - median) / MAD`. These are candidates, not frozen algorithms. Stage 7 defines minimum history, treatment of the investigation day, zero baseline/MAD, ties, constant inputs, and missing samples. Undefined statistics must not become invented finite signals.

## Relationship eligibility and labels

Evaluate only registered relationships with defined inputs and lags. Use the feature builder's alignment policy. Report actual usable pairs, not calendar days. Exposure results expose both group counts. Preserve effect meaning/units: a rank coefficient and an HRV percentage difference are different quantities.

| Proposed label | Intended interpretation |
| --- | --- |
| `INSUFFICIENT_DATA` | Too little eligible information. |
| `WEAK_SIGNAL` | Limited signal with substantial uncertainty. |
| `NO_MEANINGFUL_SIGNAL` | Implemented criteria found no meaningful association in eligible data. |
| `POSSIBLE_ASSOCIATION` | Potentially useful association under product criteria. |
| `CONSISTENT_ASSOCIATION` | Satisfies stronger consistency criteria. |

Stage 7 defines reproducible criteria. Insufficient data is not “no relationship”; no meaningful signal is not proof a factor has no effect.

## Confounders

Alcohol/HRV may include sleep duration, training load, and illness as competing factors. A comparison may show both lower HRV and shorter sleep on alcohol nights. Communicate that context without claiming the comparison isolates alcohol's effect. Never call a result “adjusted” unless code performs the stated adjustment. Serious causal inference is outside hackathon scope.

## Investigation and EvidenceBundle

Conceptual `investigateOutcome({ userId, outcome, date })`:

1. Read current outcome and eligible context.
2. Calculate/retrieve baselines and anomalies.
3. Retrieve allowed candidate factors from the Relationship Registry.
4. Evaluate history using declared methods and lags.
5. Identify known, unknown, and unavailable context.
6. Return structured facts for explanation and UI.

Stage 0 freezes the bundle representation in [domain contracts](DOMAIN.md): current value/date come from its `dailyFeatures`, earlier dates from `contextDays`, and method/lag/competing-factor definitions from the registered relationship ID. Results carry effects, eligible counts, labels, and limits. Missing context includes a feature and its date, validated against registry lags and unknown states. Absent outcomes remain unknown. These schemas define representation; Stage 8 implements investigation.

Stage 9 selects a question from relevant unknowns. One answer can change today's context without changing a historical relationship's strength. Show that distinction; recomputation does not guarantee stronger evidence.

## Communication rules

- Trace every number to the bundle; add no percentage, probability, count, or causal explanation during paraphrasing.
- Say “in your recorded history” and explain evaluated period/count where useful.
- Use “associated with” or “followed by.” “Investigate why” promises investigation, not causal certainty.
- Explain missing inputs, insufficient history, and competing factors plainly. Follow-up questions gather context, not diagnoses.
- Do not turn symptoms into diagnoses or prescribe treatment from correlations.

Illustrative wording: “On recorded alcohol nights, next-day HRV was lower. Sleep was also shorter, so this comparison does not isolate alcohol's effect.” Any quantities must come from the actual bundle.

## Later validation

Stage 2 supplies seeded histories and documented planted patterns. Stage 7 should recover expected direction and handle unrelated factors, sparse pairs, missing days, explicit lags, constant inputs, and zero spread. Synthetic patterns validate implementation, not clinical validity. Stage 13 checks the same pipeline against real-source quirks. Stage 14 compares baseline/intervention periods with tracked confounders and conservative conclusions.
