import { z } from "zod";
import { RecordIdSchema, TimestampSchema, TimeZoneSchema } from "./primitives";

export const Events = Object.freeze({
  ENERGY: "energy", STRESS: "stress", MOOD: "mood", SORENESS: "soreness",
  ALCOHOL: "alcohol", CAFFEINE: "caffeine", LATE_MEAL: "late_meal",
  ILLNESS: "illness", PAIN: "pain", WORKOUT_RPE: "workout_rpe",
} as const);
export const SubjectiveEventTypeSchema = z.enum(Events);
export type SubjectiveEventType = z.infer<typeof SubjectiveEventTypeSchema>;
export const RatingSchema = z.number().min(0).max(10);

// Reported drinks are counts of beverages, never inferred standard alcohol doses.
export const AlcoholValueSchema = z.strictObject({
  consumed: z.boolean(),
  quantity: z.number().positive().nullable().or(z.literal(0)),
  unit: z.literal("reported_drinks"),
  beverage: z.string().min(1).max(100).optional(),
}).refine((value) => value.consumed ? value.quantity === null || value.quantity > 0 : value.quantity === 0,
  "Reported absence requires zero; reported consumption requires a positive or unknown quantity");
export const CaffeineValueSchema = z.strictObject({
  consumed: z.boolean(),
  amountMg: z.number().nonnegative().nullable(),
}).refine((value) => value.consumed ? value.amountMg === null || value.amountMg > 0 : value.amountMg === 0,
  "Reported absence requires zero; reported intake requires a positive or unknown dose");
export const PainValueSchema = z.strictObject({
  present: z.boolean(),
  location: z.string().min(1).max(200).nullable(),
  intensity: RatingSchema.nullable(),
}).refine((value) => value.present
  ? value.intensity === null || value.intensity > 0
  : value.intensity === 0 && value.location === null,
  "Absent pain requires zero intensity and no location; present pain can have unknown intensity");

export const SubjectiveEventRegistry = Object.freeze({
  energy: Object.freeze({ label: "Energy", valueSchema: RatingSchema, anchors: Object.freeze({ low: "No energy", high: "Very energetic" }) }),
  stress: Object.freeze({ label: "Stress", valueSchema: RatingSchema, anchors: Object.freeze({ low: "No stress", high: "Extremely stressed" }) }),
  mood: Object.freeze({ label: "Mood", valueSchema: RatingSchema, anchors: Object.freeze({ low: "Very low mood", high: "Very positive mood" }) }),
  soreness: Object.freeze({ label: "Soreness", valueSchema: RatingSchema, anchors: Object.freeze({ low: "No soreness", high: "Extreme soreness" }) }),
  alcohol: Object.freeze({ label: "Alcohol", valueSchema: AlcoholValueSchema }),
  caffeine: Object.freeze({ label: "Caffeine", valueSchema: CaffeineValueSchema }),
  late_meal: Object.freeze({ label: "Reported late meal", valueSchema: z.boolean() }),
  illness: Object.freeze({ label: "Reported illness/symptoms", valueSchema: z.boolean() }),
  pain: Object.freeze({ label: "Pain", valueSchema: PainValueSchema, anchors: Object.freeze({ low: "No pain", high: "Worst imaginable pain" }) }),
  workout_rpe: Object.freeze({ label: "Workout effort", valueSchema: RatingSchema, anchors: Object.freeze({ low: "No effort", high: "Maximal effort" }) }),
} as const);

function eventSchema<const K extends SubjectiveEventType, V extends z.ZodType>(type: K, valueSchema: V) {
  return z.strictObject({
    id: RecordIdSchema,
    type: z.literal(type),
    value: valueSchema,
    occurredAt: TimestampSchema,
    capturedAt: TimestampSchema,
    timeZone: TimeZoneSchema,
    conversationTurnId: RecordIdSchema,
    extractionConfidence: z.number().min(0).max(1).nullable(),
    workoutSessionId: RecordIdSchema.optional(),
  });
}

export const SubjectiveEventSchema = z.discriminatedUnion("type", [
  eventSchema("energy", SubjectiveEventRegistry.energy.valueSchema), eventSchema("stress", SubjectiveEventRegistry.stress.valueSchema),
  eventSchema("mood", SubjectiveEventRegistry.mood.valueSchema), eventSchema("soreness", SubjectiveEventRegistry.soreness.valueSchema),
  eventSchema("alcohol", AlcoholValueSchema), eventSchema("caffeine", CaffeineValueSchema),
  eventSchema("late_meal", SubjectiveEventRegistry.late_meal.valueSchema),
  eventSchema("illness", SubjectiveEventRegistry.illness.valueSchema), eventSchema("pain", PainValueSchema),
  eventSchema("workout_rpe", SubjectiveEventRegistry.workout_rpe.valueSchema),
]).refine((event) => Date.parse(event.occurredAt) <= Date.parse(event.capturedAt), {
  message: "Observed events cannot occur after capture", path: ["occurredAt"],
});
export type SubjectiveEvent = z.infer<typeof SubjectiveEventSchema>;

// Extraction candidates cannot assign persistence IDs, capture timestamps, or
// conversation/session ownership. Application code supplies those after validation.
function draftSchema<const K extends SubjectiveEventType, V extends z.ZodType>(type: K, valueSchema: V) {
  return eventSchema(type, valueSchema).omit({
    id: true, capturedAt: true, timeZone: true, conversationTurnId: true, workoutSessionId: true,
  });
}
export const SubjectiveEventDraftSchema = z.discriminatedUnion("type", [
  draftSchema("energy", SubjectiveEventRegistry.energy.valueSchema), draftSchema("stress", SubjectiveEventRegistry.stress.valueSchema),
  draftSchema("mood", SubjectiveEventRegistry.mood.valueSchema), draftSchema("soreness", SubjectiveEventRegistry.soreness.valueSchema),
  draftSchema("alcohol", AlcoholValueSchema), draftSchema("caffeine", CaffeineValueSchema),
  draftSchema("late_meal", SubjectiveEventRegistry.late_meal.valueSchema),
  draftSchema("illness", SubjectiveEventRegistry.illness.valueSchema), draftSchema("pain", PainValueSchema),
  draftSchema("workout_rpe", SubjectiveEventRegistry.workout_rpe.valueSchema),
]);
export type SubjectiveEventDraft = z.infer<typeof SubjectiveEventDraftSchema>;

// Every open item in one clarification, in the order the speaker mentioned them.
export const OpenEventTypesSchema = z.array(SubjectiveEventTypeSchema).min(1).max(4);
export const ExtractionDraftResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("captured"), events: z.array(SubjectiveEventDraftSchema).min(1) }),
  z.strictObject({ status: z.literal("nothing_trackable"), reason: z.string().min(1).max(500) }),
  z.strictObject({ status: z.literal("needs_clarification"), eventTypes: OpenEventTypesSchema, reason: z.string().min(1).max(500) }),
]);
export type ExtractionDraftResult = z.infer<typeof ExtractionDraftResultSchema>;

// Results stored before multi-item clarification carried a single `eventType`; read them as one open item.
function upgradeLegacyClarification(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record.status !== "needs_clarification" || "eventTypes" in record || typeof record.eventType !== "string") return value;
  const { eventType, ...rest } = record;
  return { ...rest, eventTypes: [eventType] };
}

// Canonical pipeline outcome. `captured` is confirmed only after successful storage.
export const ExtractionResultSchema = z.preprocess(upgradeLegacyClarification, z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("captured"), events: z.array(SubjectiveEventSchema).min(1) }),
  z.strictObject({ status: z.literal("nothing_trackable"), reason: z.string().min(1).max(500) }),
  z.strictObject({
    status: z.literal("needs_clarification"),
    eventTypes: OpenEventTypesSchema,
    reason: z.string().min(1).max(500),
  }),
]));
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
