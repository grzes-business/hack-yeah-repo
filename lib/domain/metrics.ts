import { z } from "zod";
import { RecordIdSchema, TimestampSchema } from "./primitives";

export const Metrics = Object.freeze({
  HRV: "hrv",
  RESTING_HR: "resting_hr",
  SLEEP_DURATION: "sleep_duration",
  SLEEP_START: "sleep_start",
  SLEEP_END: "sleep_end",
  STEPS: "steps",
  ACTIVE_ENERGY: "active_energy",
  WORKOUT_DURATION: "workout_duration",
  WORKOUT_AVG_HR: "workout_avg_hr",
} as const);
export const MetricSchema = z.enum(Metrics);
export type Metric = z.infer<typeof MetricSchema>;

export const MetricRegistry = Object.freeze({
  hrv: Object.freeze({ label: "HRV (SDNN)", unit: "ms", valueSchema: z.number().nonnegative(), dayAnchor: "end" }),
  resting_hr: Object.freeze({ label: "Resting heart rate", unit: "bpm", valueSchema: z.number().positive(), dayAnchor: "end" }),
  sleep_duration: Object.freeze({ label: "Sleep duration", unit: "min", valueSchema: z.number().nonnegative(), dayAnchor: "wake" }),
  sleep_start: Object.freeze({ label: "Sleep start", unit: "iso8601", valueSchema: TimestampSchema, dayAnchor: "wake" }),
  sleep_end: Object.freeze({ label: "Sleep end", unit: "iso8601", valueSchema: TimestampSchema, dayAnchor: "wake" }),
  steps: Object.freeze({ label: "Steps", unit: "count", valueSchema: z.number().int().nonnegative(), dayAnchor: "end" }),
  active_energy: Object.freeze({ label: "Active energy", unit: "kcal", valueSchema: z.number().nonnegative(), dayAnchor: "end" }),
  workout_duration: Object.freeze({ label: "Workout duration", unit: "min", valueSchema: z.number().nonnegative(), dayAnchor: "end" }),
  workout_avg_hr: Object.freeze({ label: "Workout average heart rate", unit: "bpm", valueSchema: z.number().positive(), dayAnchor: "end" }),
} as const);

export const HealthSourceSchema = z.enum(["mock", "apple_health"]);
export const MetricSourceSchema = z.strictObject({
  type: HealthSourceSchema,
  externalId: RecordIdSchema,
  device: z.string().min(1).max(200).optional(),
  provider: z.string().min(1).max(200).optional(),
});

function sampleSchema<const K extends Metric, V extends z.ZodType, const U extends string>(
  metric: K, definition: { valueSchema: V; unit: U },
) {
  return z.strictObject({
    id: RecordIdSchema,
    metric: z.literal(metric),
    value: definition.valueSchema,
    unit: z.literal(definition.unit),
    startedAt: TimestampSchema,
    endedAt: TimestampSchema,
    source: MetricSourceSchema,
    sessionId: RecordIdSchema.optional(),
  });
}

export const MetricSampleSchema = z.discriminatedUnion("metric", [
  sampleSchema("hrv", MetricRegistry.hrv), sampleSchema("resting_hr", MetricRegistry.resting_hr),
  sampleSchema("sleep_duration", MetricRegistry.sleep_duration), sampleSchema("sleep_start", MetricRegistry.sleep_start),
  sampleSchema("sleep_end", MetricRegistry.sleep_end), sampleSchema("steps", MetricRegistry.steps),
  sampleSchema("active_energy", MetricRegistry.active_energy), sampleSchema("workout_duration", MetricRegistry.workout_duration),
  sampleSchema("workout_avg_hr", MetricRegistry.workout_avg_hr),
]).superRefine((sample, ctx) => {
  if (Date.parse(sample.startedAt) > Date.parse(sample.endedAt)) {
    ctx.addIssue({ code: "custom", path: ["endedAt"], message: "Sample end precedes its start" });
  }
  if (sample.metric === "sleep_start" && Date.parse(sample.value) !== Date.parse(sample.startedAt)) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Sleep start must match the session start" });
  }
  if (sample.metric === "sleep_end" && Date.parse(sample.value) !== Date.parse(sample.endedAt)) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Sleep end must match the session end" });
  }
});

export type MetricSample = z.infer<typeof MetricSampleSchema>;
