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
export const CandidateSchema = z.strictObject({
 type: SubjectiveEventTypeSchema,
 rating: z.number().min(0).max(10).nullable(), consumed: z.boolean().nullable(),
 quantity: z.number().nonnegative().nullable(), beverage: z.string().max(100).nullable(),
 amountMg: z.number().nonnegative().nullable(), present: z.boolean().nullable(),
 location: z.string().max(200).nullable(), intensity: z.number().min(0).max(10).nullable(),
 booleanValue: z.boolean().nullable(),
 timing: z.strictObject({ kind: z.enum(["now", "today", "yesterday", "days_ago", "date"]), daysAgo: z.number().int().min(0).max(3650).nullable(), date: z.string().nullable(), clock: z.string().nullable() }),
});
export const ProviderExtractionSchema = z.strictObject({
 status: z.enum(["captured", "nothing_trackable", "needs_clarification"]),
 events: z.array(CandidateSchema).max(20), eventType: SubjectiveEventTypeSchema.nullable(), reason: z.string().max(500).nullable(),
});
