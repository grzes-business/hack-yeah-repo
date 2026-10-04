import { z } from "zod";
import { RecordIdSchema, LocalDateSchema, TimeZoneSchema, SubjectiveEventSchema, SubjectiveEventTypeSchema, OutcomeSchema } from "../domain";
import { InvestigationResultSchema } from "../investigation/contracts";
import { LoopViewSchema } from "../questions/contracts";
import { CaptureRecordSchema } from "../capture/contracts";
export const VoiceContextSchema = z.discriminatedUnion("mode", [
 z.strictObject({mode:z.literal("report")}),
 z.strictObject({mode:z.literal("morning_checkin"),date:LocalDateSchema,dimension:z.enum(["energy","soreness","mood","illness"])}),
 z.strictObject({mode:z.literal("investigate"),loopId:z.uuid(),key:z.string().min(1)}),
]);
export type VoiceContext = z.infer<typeof VoiceContextSchema>;
export const VoiceTurnInputSchema = z.strictObject({ turnId:RecordIdSchema, targetRootId:RecordIdSchema.nullable().default(null), context:VoiceContextSchema.default({mode:"report"}) });
export const VoiceIntentSchema = z.strictObject({
 kind:z.enum(["report","followup","retrieve","capabilities","cancel","greeting","noise","unsupported","unclear","investigate","question_answer"]),
 language:z.enum(["en","pl"]),
 query:z.strictObject({ kind:z.enum(["today","yesterday","date","range","unspecified"]), from:LocalDateSchema.nullable(), to:LocalDateSchema.nullable(), type:SubjectiveEventTypeSchema.nullable(), includeDemo:z.boolean() }),
 investigationOutcome:OutcomeSchema.nullable(),
 unsupportedMetric:z.string().max(40).nullable(),
 checkinContext:z.strictObject({date:LocalDateSchema,dimension:z.enum(["energy","soreness","mood","illness"])}).optional(),
 questionContext:z.strictObject({loopId:z.uuid(),key:z.string()}).optional(),
});
export const RetrievalSchema = z.strictObject({ from:LocalDateSchema, to:LocalDateSchema, timeZone:TimeZoneSchema, events:z.array(SubjectiveEventSchema).max(100), complete:z.boolean(), syntheticIncluded:z.boolean() });
export const VoiceOutcomeSchema = z.strictObject({
 turnId:RecordIdSchema, disposition:z.enum(["capture","followup","retrieval","conversation","ignore","cancel"]),
 reply:z.string().max(16000).nullable(), capture:CaptureRecordSchema.nullable(),
 investigation:InvestigationResultSchema.optional(),
 questions:LoopViewSchema.optional(),
 questionAnswer:z.boolean().optional(),
 checkin:z.unknown().optional(),
 targetRootId:RecordIdSchema.nullable(), retrieval:RetrievalSchema.nullable(),
});
export type VoiceOutcome = z.infer<typeof VoiceOutcomeSchema>;
