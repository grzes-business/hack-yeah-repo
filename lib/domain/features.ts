import { z } from "zod";
import { Events, SubjectiveEventRegistry } from "./events";
import { Metrics, MetricRegistry } from "./metrics";
import { DOMAIN_CONTRACT_VERSION, LocalDateSchema, ProvenanceSchema, RecordIdSchema, TimestampSchema, TimeZoneSchema } from "./primitives";

export const Features = Object.freeze({ ...Metrics, ...Events });
export const FeatureSchema = z.enum(Features);
export type Feature = z.infer<typeof FeatureSchema>;

// Daily projections retain rating semantics; alcohol becomes a reported exposure,
// caffeine becomes known mg. Unknown caffeine dose is an unknown daily feature.
export const FeatureRegistry = Object.freeze({
  ...MetricRegistry,
  energy: Object.freeze({ ...SubjectiveEventRegistry.energy, unit: "rating" }),
  stress: Object.freeze({ ...SubjectiveEventRegistry.stress, unit: "rating" }),
  mood: Object.freeze({ ...SubjectiveEventRegistry.mood, unit: "rating" }),
  soreness: Object.freeze({ ...SubjectiveEventRegistry.soreness, unit: "rating" }),
  alcohol: Object.freeze({ label: "Reported alcohol exposure", valueSchema: z.boolean(), unit: "boolean" }),
  caffeine: Object.freeze({ label: "Reported caffeine dose", valueSchema: z.number().nonnegative(), unit: "mg" }),
  late_meal: Object.freeze({ ...SubjectiveEventRegistry.late_meal, unit: "boolean" }),
  illness: Object.freeze({ ...SubjectiveEventRegistry.illness, unit: "boolean" }),
  pain: Object.freeze({ ...SubjectiveEventRegistry.pain, unit: "reported_pain" }),
  workout_rpe: Object.freeze({ ...SubjectiveEventRegistry.workout_rpe, unit: "rating" }),
} as const);

export const UnknownFeatureSchema = z.strictObject({
  status: z.literal("unknown"),
  reason: z.enum(["not_observed", "not_available", "ambiguous", "insufficient_coverage"]),
});

function featureState<V extends z.ZodType>(valueSchema: V, source: "metric" | "subjective") {
  const provenance = ProvenanceSchema.refine((refs) => source === "metric"
    ? refs.metricSampleIds.length > 0 && refs.subjectiveEventIds.length === 0
    : refs.subjectiveEventIds.length > 0 && refs.metricSampleIds.length === 0,
  `Expected ${source} observation provenance`);
  const known = z.strictObject({
    status: z.literal("known"), value: valueSchema, provenance,
  });
  return z.discriminatedUnion("status", [known, UnknownFeatureSchema]);
}

export const DailyFeatureStatesSchema = z.strictObject({
  hrv: featureState(FeatureRegistry.hrv.valueSchema, "metric"),
  resting_hr: featureState(FeatureRegistry.resting_hr.valueSchema, "metric"),
  sleep_duration: featureState(FeatureRegistry.sleep_duration.valueSchema, "metric"),
  sleep_start: featureState(FeatureRegistry.sleep_start.valueSchema, "metric"),
  sleep_end: featureState(FeatureRegistry.sleep_end.valueSchema, "metric"),
  steps: featureState(FeatureRegistry.steps.valueSchema, "metric"),
  active_energy: featureState(FeatureRegistry.active_energy.valueSchema, "metric"),
  workout_duration: featureState(FeatureRegistry.workout_duration.valueSchema, "metric"),
  workout_avg_hr: featureState(FeatureRegistry.workout_avg_hr.valueSchema, "metric"),
  energy: featureState(FeatureRegistry.energy.valueSchema, "subjective"),
  stress: featureState(FeatureRegistry.stress.valueSchema, "subjective"),
  mood: featureState(FeatureRegistry.mood.valueSchema, "subjective"),
  soreness: featureState(FeatureRegistry.soreness.valueSchema, "subjective"),
  alcohol: featureState(FeatureRegistry.alcohol.valueSchema, "subjective"),
  caffeine: featureState(FeatureRegistry.caffeine.valueSchema, "subjective"),
  late_meal: featureState(FeatureRegistry.late_meal.valueSchema, "subjective"),
  illness: featureState(FeatureRegistry.illness.valueSchema, "subjective"),
  pain: featureState(FeatureRegistry.pain.valueSchema, "subjective"),
  workout_rpe: featureState(FeatureRegistry.workout_rpe.valueSchema, "subjective"),
});

export const DailyFeaturesSchema = z.strictObject({
  contractVersion: z.literal(DOMAIN_CONTRACT_VERSION),
  userId: RecordIdSchema,
  date: LocalDateSchema,
  timeZone: TimeZoneSchema,
  builtAt: TimestampSchema,
  builderVersion: z.string().min(1).max(100),
  features: DailyFeatureStatesSchema,
}).superRefine((daily, ctx) => {
  const start = daily.features.sleep_start;
  const end = daily.features.sleep_end;
  if (start.status === "known" && end.status === "known" && Date.parse(start.value) > Date.parse(end.value)) {
    ctx.addIssue({ code: "custom", path: ["features", "sleep_end"], message: "Sleep end precedes sleep start" });
  }
});

export type DailyFeatures = z.infer<typeof DailyFeaturesSchema>;
export type DailyFeatureStates = z.infer<typeof DailyFeatureStatesSchema>;
