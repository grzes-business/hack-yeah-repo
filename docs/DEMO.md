# Product experience and stage demo

Wearables observe a change; conversation supplies context they cannot measure. Demonstrate that loop with provenance and uncertainty. The complete evidence loop is a target for later stages. Stage 2 currently provides the sample-history preparation and Timeline inspection steps.

## Demo sequence

| Step | User experience | System behavior |
| --- | --- | --- |
| Notice | Today highlights low HRV and higher resting heart rate versus personal history. | Measurements and calculated baseline/deviation with sufficient history. |
| Investigate | User asks why they feel exhausted. | Recorded energy or clarification if unknown; supported outcome investigation. |
| Inspect context | Sleep/training are visible; illness, stress, or alcohol may be unknown. | Known versus missing context under registered relationships. |
| Ask | One useful question is phrased naturally. | Question identity comes from deterministic selection. |
| Capture | User reports drinking the prior evening or feeling unwell. | Validated observation, occurrence time, and turn provenance. |
| Recompute | Updated investigation shows newly known context. | Actual recomputation and honest before/after differences. |
| Next step | Inspect Evidence/Timeline; later consider a personal experiment. | Effects, counts, limits, and source remain visible. |

Choose a fixture whose registry entries support the outcome and question. Example deviations such as −31% are not hard-coded facts; calculate from seeded inputs. Reported illness adds context without proving a cause.

## Product surfaces

**Today (`/`)**: a few unusual observations, baseline comparisons, and unresolved questions leading to a useful action. Avoid centering a proprietary recovery/sleep/stress score.

**Talk (`/talk`)**: microphone/session state, transcript, accepted observations, and clarification/persistence status.

**Evidence (`/evidence`)**: effects/methods, sample sizes, labels, evaluated period, and competing factors, including inconclusive/insufficient-data states.

**Timeline (`/timeline`)**: wearable and voice observations in time order with source and provenance. Distinguish derived interpretations from observations.

**Experiments (`/experiments`, later)**: structured N-of-1 proposals and descriptive results after Stage 14.

## Demo milestones

- Stage 2 complete: Today loads/removes 56 days of synthetic history; Timeline labels wearable and subjective fixtures. [FIXTURES.md](FIXTURES.md) records ground truth and omissions. No investigation/baseline/evidence is shown yet.
- Stages 3–5: conversation, validated capture, controlled check-ins.
- Stages 6–8: features, calculated evidence, voice explanation.
- Stage 9: differentiating active-sensing loop; Stage 10: clear product UI.
- Stages 11–13: real Apple input; retain a clearly identified synthetic fallback.
- Stage 14: optional later next-step story with outcomes, duration, inclusion criteria, and confounders.

Do not present synthetic measurements as real personal data. Show an evidence-state change rather than merely a new model response. If the answer leaves the investigation inconclusive, explain that accurately.

## Stage 4 capture milestone

After voice saves a finalized user turn, Talk extracts predefined observations and displays saved/clarification/no-trackable/failure status. Try an explicit energy rating plus yesterday’s alcohol, then use the original turn’s correction form and inspect Timeline. [CAPTURE](CAPTURE.md) records the time/retry/correction rules and manual acceptance matrix; analytics are still unavailable.

## Stage 8 film preparation

Load sample history on Today. On Evidence choose HRV, the last completed sample date (yesterday with the default loader), and Synthetic demonstration; choose Investigate. The result shows the current recorded HRV or an explicit gap, the preceding 42-day alcohol comparison with real eligible counts/effects, prior-day exposure and competing context, plus unknown factors and interpretation limits. Alternatively say “Investigate the synthetic demo HRV for yesterday” in Talk. Do not script a fixed percentage: seeded outputs and missingness determine the facts. Stage 9 adds the selected missing-context question and answer/recompute loop.

## Stage 9 reproducible loop

Load default samples in a fresh session, select HRV / **2026-09-20** / Synthetic demonstration in Evidence, and ask about missing context. Alcohol on **2026-09-19** is deliberately omitted. Answer **No.**; show false becoming known while historical effects remain unchanged. Answers are visibly simulated and isolated from personal records. See the [Stage 9 acceptance validation](stages/stage-09-missing-evidence-loop.md).
