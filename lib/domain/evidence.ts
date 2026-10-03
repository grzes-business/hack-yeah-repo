import { z } from "zod";
import { DailyFeaturesSchema, FeatureSchema, FeatureRegistry } from "./features";
import { MetricRegistry } from "./metrics";
import { AnalysisPeriodSchema, DOMAIN_CONTRACT_VERSION, LocalDateSchema, ProvenanceSchema, RecordIdSchema, TimestampSchema, addCalendarDays } from "./primitives";
import { OutcomeSchema, RelationshipIdSchema, RelationshipRegistry } from "./relationships";

export const EvidenceLevels = Object.freeze({
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA", WEAK_SIGNAL: "WEAK_SIGNAL",
  NO_MEANINGFUL_SIGNAL: "NO_MEANINGFUL_SIGNAL", POSSIBLE_ASSOCIATION: "POSSIBLE_ASSOCIATION",
  CONSISTENT_ASSOCIATION: "CONSISTENT_ASSOCIATION",
} as const);
export const EvidenceLevelSchema = z.enum(EvidenceLevels);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;
const EvaluatedEvidenceLevelSchema = EvidenceLevelSchema.exclude(["INSUFFICIENT_DATA"]);

export const SpearmanEffectSchema = z.strictObject({
  kind: z.literal("spearman"), rho: z.number().min(-1).max(1),
});
export const ExposureEffectSchema = z.strictObject({
  kind: z.literal("exposure"),
  exposedCount: z.number().int().positive(), controlCount: z.number().int().positive(),
  exposedMedian: z.number(), controlMedian: z.number(),
  medianDifference: z.number(), relativeDifference: z.number().nullable(),
  unit: z.enum(["ms", "min", "rating"]),
});

const resultFields = {
  relationshipId: RelationshipIdSchema,
  userId: RecordIdSchema,
  period: AnalysisPeriodSchema,
  pairedOutcomeDates: z.array(LocalDateSchema),
  sampleSize: z.number().int().nonnegative(),
  computedAt: TimestampSchema,
  analysisVersion: z.string().min(1).max(100),
};

export const RelationshipResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    ...resultFields, status: z.literal("insufficient_data"),
    evidence: z.literal("INSUFFICIENT_DATA"), effect: z.null(),
    limitations: z.array(z.string().min(1).max(500)).min(1),
  }),
  z.strictObject({
    ...resultFields, status: z.literal("evaluated"),
    evidence: EvaluatedEvidenceLevelSchema,
    effect: z.discriminatedUnion("kind", [SpearmanEffectSchema, ExposureEffectSchema]),
    limitations: z.array(z.string().min(1).max(500)),
  }),
]).superRefine((result, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  if (new Set(result.pairedOutcomeDates).size !== result.pairedOutcomeDates.length) {
    issue(["pairedOutcomeDates"], "Each daily outcome can be paired at most once");
  }
  if (result.pairedOutcomeDates.length !== result.sampleSize) {
    issue(["sampleSize"], "Sample size must match eligible outcome dates");
  }
  if (result.pairedOutcomeDates.some((date) => date < result.period.from || date > result.period.to)) {
    issue(["pairedOutcomeDates"], "Outcome dates must fall in the evaluated period");
  }
  if (result.status !== "evaluated") return;
  const definition = RelationshipRegistry[result.relationshipId];
  if (result.effect.kind !== definition.method) issue(["effect", "kind"], "Effect method must match the registered relationship");
  if (result.sampleSize < 2) issue(["sampleSize"], "An evaluated comparison requires at least two observations");
  if (result.effect.kind === "exposure") {
    const effect = result.effect;
    if (effect.exposedCount + effect.controlCount !== result.sampleSize) issue(["sampleSize"], "Exposure group counts must sum to sample size");
    const outcome = FeatureRegistry[definition.outcome];
    if (effect.unit !== outcome.unit) issue(["effect", "unit"], "Effect unit must match the outcome");
    if (!outcome.valueSchema.safeParse(effect.exposedMedian).success || !outcome.valueSchema.safeParse(effect.controlMedian).success) {
      issue(["effect"], "Group medians must be valid outcome values");
    }
    const close = (actual: number, expected: number) => Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected));
    if (!close(effect.medianDifference, effect.exposedMedian - effect.controlMedian)) issue(["effect", "medianDifference"], "Difference must equal exposed minus control median");
    if (effect.controlMedian === 0) {
      if (effect.relativeDifference !== null) issue(["effect", "relativeDifference"], "A zero control median has no defined relative difference");
    } else if (effect.relativeDifference === null || !close(effect.relativeDifference, effect.medianDifference / effect.controlMedian)) {
      issue(["effect", "relativeDifference"], "Relative difference must use the control median as denominator");
    }
  }
});
export type RelationshipResult = z.infer<typeof RelationshipResultSchema>;

function anomalySchema<const K extends "hrv" | "resting_hr" | "sleep_duration" | "steps" | "active_energy" | "workout_duration" | "workout_avg_hr", V extends z.ZodType, const U extends string>(
  metric: K, definition: { valueSchema: V; unit: U },
) {
  return z.strictObject({
    metric: z.literal(metric), value: definition.valueSchema, baseline: definition.valueSchema,
    unit: z.literal(definition.unit), baselinePeriod: AnalysisPeriodSchema,
    baselineSampleSize: z.number().int().positive(),
    relativeDifference: z.number().nullable(),
    classification: z.enum(["unusually_low", "unusually_high"]),
    provenance: ProvenanceSchema,
  });
}

export const AnomalySchema = z.discriminatedUnion("metric", [
  anomalySchema("hrv", MetricRegistry.hrv), anomalySchema("resting_hr", MetricRegistry.resting_hr),
  anomalySchema("sleep_duration", MetricRegistry.sleep_duration), anomalySchema("steps", MetricRegistry.steps),
  anomalySchema("active_energy", MetricRegistry.active_energy), anomalySchema("workout_duration", MetricRegistry.workout_duration),
  anomalySchema("workout_avg_hr", MetricRegistry.workout_avg_hr),
]).superRefine((anomaly, ctx) => {
  const issue = (path: string[], message: string) => ctx.addIssue({ code: "custom", path, message });
  if (anomaly.classification === "unusually_low" ? anomaly.value >= anomaly.baseline : anomaly.value <= anomaly.baseline) {
    issue(["classification"], "Anomaly direction must match its baseline deviation");
  }
  if (anomaly.provenance.metricSampleIds.length === 0 || anomaly.provenance.subjectiveEventIds.length !== 0) {
    issue(["provenance"], "Objective anomalies require objective sample provenance");
  }
  const expected = anomaly.baseline === 0 ? null : (anomaly.value - anomaly.baseline) / anomaly.baseline;
  if (expected === null ? anomaly.relativeDifference !== null
    : anomaly.relativeDifference === null || Math.abs(anomaly.relativeDifference - expected) > 1e-9 * Math.max(1, Math.abs(expected))) {
    issue(["relativeDifference"], "Relative difference must match the baseline; zero baseline requires null");
  }
});
export type Anomaly = z.infer<typeof AnomalySchema>;

export const EvidenceBundleSchema = z.strictObject({
  contractVersion: z.literal(DOMAIN_CONTRACT_VERSION),
  outcome: OutcomeSchema,
  dailyFeatures: DailyFeaturesSchema,
  contextDays: z.array(DailyFeaturesSchema),
  generatedAt: TimestampSchema,
  analysisVersion: z.string().min(1).max(100),
  currentAnomalies: z.array(AnomalySchema),
  relationships: z.array(RelationshipResultSchema),
  missingPotentialFactors: z.array(z.strictObject({ feature: FeatureSchema, date: LocalDateSchema })),
  limitations: z.array(z.string().min(1).max(500)),
}).superRefine((bundle, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const allowed = Object.values(RelationshipRegistry).filter((entry) => entry.outcome === bundle.outcome);
  const relevant = new Set(allowed.flatMap((entry) => [
    { feature: entry.factor, lagDays: entry.lagDays }, ...entry.confounders,
  ]).map((ref) => `${ref.feature}:${addCalendarDays(bundle.dailyFeatures.date, -ref.lagDays)}`));
  const days = new Map([[bundle.dailyFeatures.date, bundle.dailyFeatures]]);
  bundle.contextDays.forEach((day, index) => {
    if (days.has(day.date)) issue(["contextDays", index, "date"], "Context dates must be unique and separate from the current day");
    if (day.date >= bundle.dailyFeatures.date) issue(["contextDays", index, "date"], "Additional context must precede the investigated day");
    if (day.userId !== bundle.dailyFeatures.userId || day.timeZone !== bundle.dailyFeatures.timeZone) {
      issue(["contextDays", index], "Context must use the investigated user and time zone");
    }
    days.set(day.date, day);
  });
  const seenRelationships = new Set<string>();
  bundle.relationships.forEach((result, index) => {
    if (RelationshipRegistry[result.relationshipId].outcome !== bundle.outcome) issue(["relationships", index], "Relationship outcome does not match the investigation");
    if (result.userId !== bundle.dailyFeatures.userId) issue(["relationships", index, "userId"], "Evidence must belong to the investigated user");
    if (result.analysisVersion !== bundle.analysisVersion) issue(["relationships", index, "analysisVersion"], "Analysis versions must match");
    if (seenRelationships.has(result.relationshipId)) issue(["relationships", index], "Duplicate relationship result");
    seenRelationships.add(result.relationshipId);
  });
  const seenAnomalies = new Set<string>();
  bundle.currentAnomalies.forEach((anomaly, index) => {
    const current = bundle.dailyFeatures.features[anomaly.metric];
    if (current.status !== "known" || current.value !== anomaly.value) issue(["currentAnomalies", index], "Anomaly must match a known current feature");
    if (current.status === "known" && anomaly.provenance.metricSampleIds.some((id) => !current.provenance.metricSampleIds.includes(id))) {
      issue(["currentAnomalies", index, "provenance"], "Anomaly provenance must come from the current feature");
    }
    if (seenAnomalies.has(anomaly.metric)) issue(["currentAnomalies", index], "Duplicate current anomaly");
    seenAnomalies.add(anomaly.metric);
  });
  const seenFactors = new Set<string>();
  bundle.missingPotentialFactors.forEach((factor, index) => {
    const key = `${factor.feature}:${factor.date}`;
    if (!relevant.has(key)) issue(["missingPotentialFactors", index], "Missing factors must match a registered feature and its lagged date");
    const day = days.get(factor.date);
    if (!day || day.features[factor.feature].status !== "unknown") issue(["missingPotentialFactors", index], "A missing factor requires an explicit unknown feature on its date");
    if (seenFactors.has(key)) issue(["missingPotentialFactors", index], "Duplicate missing factor/date");
    seenFactors.add(key);
  });
});
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
