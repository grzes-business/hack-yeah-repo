# Stage 7 analytical policy: analytics-v1

Deterministic product criteria, not clinical thresholds. No LLM participates in calculation. Code: `lib/analytics/{contracts,engine,server}.ts`; authenticated GET/POST `/api/analytics`; Evidence screen. User ownership comes from the verified JWT; requests accept only local `date` and `scope` (personal/demo).

## Windows and input eligibility

Analyze a selected local date no later than today in the profile zone. Automatically rebuild 44 explicit daily rows: selected day minus 43 through selected day inclusive. Every calendar day exists even when all features are unknown. Daily policy/scope/zone/owner must match; use complete paginated raw range reads through Stage 6. No browser-list truncation, source recipe shortcut or imputation.

Baselines use the preceding 28 calendar days; the selected day is excluded. Relationships use outcome dates in the preceding 42 calendar days, also excluding the selected day. The extra earliest day supplies registered lag-one factors. Eligible pairs require known numeric outcome and known numeric/boolean factor at the registered lagged date. Missing/conflicting features are excluded. One outcome date contributes at most once. Explicit false alcohol days are controls; unreported exposure is not a control.

Analysis versions encode both policy and builder/scope: `analytics-v1:daily-v1:personal` or `analytics-v1:daily-v1:demo`. Time zone is separate storage metadata. Synthetic history is labeled and cannot mix with personal history.

## Baselines and unusual observations

For energy and the seven numeric objective features, require at least 14 known prior days. Baseline = median; MAD = median absolute deviation from that median. Relative difference = `(current - median) / median`, null for missing/zero baseline. Robust z = `0.6745 * (current - median) / MAD`, null for missing current, insufficient history or zero MAD. No fallback spread or fabricated finite z is used.

An objective anomaly requires both `abs(z) >= 2.5` and `abs(relative difference) >= 0.15`. Direction follows the sign. Zero MAD or zero baseline prevents this classifier; diagnostics explain why. Energy gets baseline diagnostics but no objective anomaly. Sleep clock strings are not numerically analyzed. Step medians may be fractional even though raw/current step values remain integers. Anomaly provenance references the current contributing objective samples.

These windows/counts bound demo computation and avoid classifying a handful of days; the two anomaly gates prevent small shifts from becoming unusual solely because spread is tiny. These choices are conservative product heuristics, not calibrated health alerts.

## Relationships and labels

Only the four frozen edges are evaluated, with their exact registered lags. Every result includes actual eligible outcome dates/counts and its outcome-date period.

### Spearman

Compute average ranks for exact ties, then Pearson correlation of ranks. Constant ranked inputs produce an insufficient result with null effect, even with enough pairs. At least 12 pairs are required.

- `abs(rho) < 0.2`: no meaningful signal under these rules.
- `0.2 <= abs(rho) < 0.4`: weak signal.
- `abs(rho) >= 0.4`: possible association unless the stronger rule applies.
- Consistent association requires at least 24 pairs, full `abs(rho) >= 0.5`, and both chronological halves with the same direction and `abs(rho) >= 0.3` (at least 12 pairs per half).

No direction is assumed from the registry or fixture recipe. No p-value or confidence interval is claimed.

### Alcohol exposure → HRV

Require at least five exposed and five control days. Compute group medians, exposed-minus-control median difference in ms, and divide by the control median for the relative difference. Zero control median yields null relative difference; absolute difference remains defined. Group counts sum to eligible pairs.

- Absolute relative difference below 5%: no meaningful signal.
- 5% to below 10%: weak signal.
- At least 10%: possible association unless the stronger rule applies.
- Consistent association requires at least ten days in each group, full absolute relative difference at least 15%, and both chronological halves with at least three days in each group, the same direction, and absolute relative difference at least 10%.
- Undefined relative difference: no meaningful signal if absolute difference is zero, otherwise weak signal; do not invent a percentage or strong label.

Half-period checks express repeatability under this policy, not independent replication. Group/count cutoffs avoid treating a few reported intakes as strong personal evidence. Sparse history is insufficient, not proof of no relationship.

## Competing factors and freshness

Each registered confounder reports its known coverage among eligible pairs at its own lag. This is contextual coverage only: no statistical adjustment, matching, causality or diagnosis. Every result includes coverage and observational limitations.

Migration 009 adds result time-zone/builder metadata and `commit_relationship_results`, executable only by the server service role. The commit holds the same owner input lock as raw mutation, checks generation/profile zone, and requires current complete daily coverage. Four results are committed atomically; browser derived writes remain denied. Owner reads additionally filter generation, zone, scope and policy. A raw change hides old results until Analyze history rebuilds them. There is no background analysis job.

Requests check generation before reading, after building and after commit/read, with three retries. A changing input yields a truthful retry response. UI snapshots are invalidated by scope/date/history revision; freshness is at read time, never a promise against future writes. No model or process-wide evidence cache exists.

## Current verification

Static build/type/lint checks are recorded in the stage guide. Numerical reference, controlled/null fixture, hosted writer-denial, concurrency and microphone acceptance are not certified by compilation. The owner chose to defer manual walkthroughs for delivery. This policy is versioned so later verification can reproduce every calculation and label.
