import { z } from "zod";
import { ExtractionResultSchema, RecordIdSchema, SubjectiveEventTypeSchema } from "../domain";
export const CaptureInputSchema = z.strictObject({
 turnId: RecordIdSchema,
 followup: z.strictObject({ id: z.uuid(), text: z.string().trim().min(1).max(2000), revision: z.number().int().nonnegative() }).optional(),
});
export const CaptureRecordSchema = z.strictObject({
 rootTurnId: RecordIdSchema, sourceTurnId: RecordIdSchema, revision: z.number().int().nonnegative(),
 result: ExtractionResultSchema.nullable(), acceptedResult: ExtractionResultSchema.nullable(),
 pending: z.boolean(),
});
export type CaptureRecord = z.infer<typeof CaptureRecordSchema>;
// A provider transport schema, not a new event registry or domain contract.
// All optional wire fields are required nullable for strict Structured Outputs.
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();
const TimingSchema = z.union([
 z.strictObject({ kind:z.literal("now"), daysAgo:z.null(), date:z.null(), clock }),
 z.strictObject({ kind:z.literal("today"), daysAgo:z.null(), date:z.null(), clock }),
 z.strictObject({ kind:z.literal("yesterday"), daysAgo:z.null(), date:z.null(), clock }),
 z.strictObject({ kind:z.literal("days_ago"), daysAgo:z.number().int().min(0).max(3650), date:z.null(), clock }),
 z.strictObject({ kind:z.literal("date"), daysAgo:z.null(), date:z.iso.date(), clock }),
]);
const unused = {
 rating:z.null(), consumed:z.null(), quantity:z.null(), beverage:z.null(),
 amountMg:z.null(), present:z.null(), location:z.null(), intensity:z.null(), booleanValue:z.null(),
};
const rating = z.number().min(0).max(10).nullable();
// The schema itself prevents unrelated value fields and redundant timing fields.
// Nullable relevant fields remain candidates: canonicalization decides clarification.
export const CandidateSchema = z.union([
 z.strictObject({ ...unused, type:z.literal("energy"), rating, timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("stress"), rating, timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("mood"), rating, timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("soreness"), rating, timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("workout_rpe"), rating, timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("alcohol"), consumed:z.boolean().nullable(), quantity:z.number().nonnegative().nullable(), beverage:z.string().min(1).max(100).nullable(), timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("caffeine"), consumed:z.boolean().nullable(), amountMg:z.number().nonnegative().nullable(), timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("pain"), present:z.boolean().nullable(), location:z.string().min(1).max(200).nullable(), intensity:rating, timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("late_meal"), booleanValue:z.boolean().nullable(), timing:TimingSchema }),
 z.strictObject({ ...unused, type:z.literal("illness"), booleanValue:z.boolean().nullable(), timing:TimingSchema }),
]);
export const ProviderExtractionSchema = z.strictObject({
 status: z.enum(["captured", "nothing_trackable", "needs_clarification"]),
 events: z.array(CandidateSchema).max(20), eventTypes: z.array(SubjectiveEventTypeSchema).max(4), reason: z.string().max(500).nullable(),
});
