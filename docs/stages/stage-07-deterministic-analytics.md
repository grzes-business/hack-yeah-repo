# Stage 7 — Deterministic analytics

## Status and intended outcome

**Planned. This guide is an implementation specification, not a claim that the feature exists.**

Code calculates reproducible personal baselines, unusual observations, and conservative registered associations with actual counts, effects, and limitations.

**Dependencies:** [Stage 6](stage-06-daily-features.md), validated with [Stage 2](stage-02-mock-ingestion.md) fixtures.

## Context to read

Start with [agent instructions](../../AGENTS.md), [product context](../../CONTEXT.md), and [stage index](README.md). Then read [evidence](../EVIDENCE.md), [domain](../DOMAIN.md), and [fixtures](../FIXTURES.md).

**Evidence boundary:** AI can communicate evidence; AI cannot create evidence. Application code owns accepted variables, temporal alignment, calculations, question selection, permissions, and persistence. Missing observations remain unknown; synthetic records remain labeled synthetic.

## Starting point

Schemas for anomalies/results and the four-edge graph exist. Daily rows arrive from Stage 6. There are no implemented baseline, correlation, exposure-comparison, or evidence-classification algorithms yet. Synthetic recipe equations are test ground truth, not an analytical shortcut.

## Implementation work

1. Specify and version analytical policies before publishing results: historical window, current-day exclusion, eligible coverage, minimum baseline/pair/group counts, effect thresholds, consistency criteria, and classification precedence. Candidate 28-day median/relative-change/MAD formulas in EVIDENCE are examples until adopted explicitly.
2. Implement robust baselines and anomalies from eligible historical personal data. Handle zero baseline, zero MAD, sparse history, constant values, and undefined relative statistics without Infinity/NaN or fabricated deviation.
3. Align only registered relationships: factor date = outcome date minus its lag, once. Analysis periods describe outcome dates; retrieve earlier factors at range boundaries. Exclude unknown values; count actual usable pairs and retain paired outcome dates.
4. Implement Spearman with declared tie ranking and constant-input behavior. Implement alcohol exposure comparison from known true/false days with group counts, medians, absolute difference, and relative difference only when defined. Preserve method/unit meaning.
5. Apply an explicit deterministic label matrix for insufficient, weak, no meaningful, possible, and consistent association. The schema’s structural minimum of two is not the analytical eligibility threshold. Report uncertainty and competing-factor coverage; no “adjusted” claim without implemented adjustment.
6. Persist validated results through the authorized owner-scoped server writer with analysis/builder versions, periods, computation time, and freshness policy. Recompute or reject stale rows after input changes; do not mix incompatible feature generations.
7. Verify calculations on hand-worked references and controlled histories, then planted noisy fixtures. Include null/control histories and counterexamples rather than testing only successful planted signals.

## Decisions and constraints

Resolve thresholds as product analytical criteria, not clinical certainty. Document why each chosen cutoff exists and how sparse/constant histories are labeled. No p-value, confidence interval, probability, or causal adjustment may be claimed unless specifically implemented and justified. Confounder observations are contextual unless a declared algorithm adjusts for them.

## Acceptance criteria

Criteria are review requirements. For implemented stages, the status above records the previous checkpoint; it does not certify a future checkout or environment. For planned stages, all criteria remain pending until supported by recorded checks.

- **S07-AC01:** Baseline/anomaly outputs match declared hand-calculated cases and exclude the current observation from its historical reference when the policy requires it.
- **S07-AC02:** Spearman ties/constant inputs and exposure medians/group counts/effect arithmetic match independent reference cases; undefined statistics remain explicit.
- **S07-AC03:** Only four registered edges are evaluated with their exact methods/lags; first-day lag gaps and missing factors reduce eligible pairs correctly.
- **S07-AC04:** Reported dates, counts, effects, units, periods, and classification validate against the domain schema and the written analytical policy.
- **S07-AC05:** Planted fixture directions are recovered when eligible under the adopted criteria, while sparse/constant/null/control histories do not acquire invented strong evidence.
- **S07-AC06:** Identical input generation and policy version yield identical numerical results/labels without any LLM call.
- **S07-AC07:** Stale/version-incompatible results are not presented as current; server writes are owner-scoped and browser users cannot forge results.
- **S07-AC08:** Outputs describe associations and limitations, including competing factors, and make no clinical validity or causal proof claim.

## Verification and completion record

Create calculation reference tests, label-boundary cases, missing/constant/zero-spread histories, independent null/control fixtures, lag-edge cases, and repeat-generation checks. Document expected signals for the seeded fixture under the adopted policy. Validate hosted derived storage separately from pure calculations.

At completion, record the revision/date, checks actually performed, representative inputs and outputs, and limitations in this guide. Update its status and the [index](README.md); update the roadmap when the stage outcome is met. Never mark an unperformed device, provider, browser, or hosted check as passed.

## Excluded from this stage

LLM explanations, arbitrary graph discovery, causal inference, medical prediction/readiness scores, and active-question selection.

## Documentation handoff

Update EVIDENCE with adopted formulas/eligibility/classification matrix, DOMAIN only for deliberate representation changes, and PERSISTENCE with result freshness/version metadata.
