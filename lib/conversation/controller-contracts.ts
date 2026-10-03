import { z } from "zod";
import { RecordIdSchema, LocalDateSchema, TimeZoneSchema, SubjectiveEventSchema, SubjectiveEventTypeSchema } from "../domain";
import { CaptureRecordSchema } from "../capture/contracts";
export const VoiceTurnInputSchema = z.strictObject({ turnId:RecordIdSchema, targetRootId:RecordIdSchema.nullable().default(null) });
export const VoiceIntentSchema = z.strictObject({
 kind:z.enum(["report","followup","retrieve","capabilities","cancel","greeting","noise","unsupported","unclear"]),
 language:z.enum(["en","pl"]),
 query:z.strictObject({ kind:z.enum(["today","yesterday","date","range","unspecified"]), from:LocalDateSchema.nullable(), to:LocalDateSchema.nullable(), type:SubjectiveEventTypeSchema.nullable(), includeDemo:z.boolean() }),
 unsupportedMetric:z.string().max(40).nullable(),
});
export const RetrievalSchema = z.strictObject({ from:LocalDateSchema, to:LocalDateSchema, timeZone:TimeZoneSchema, events:z.array(SubjectiveEventSchema).max(100), complete:z.boolean(), syntheticIncluded:z.boolean() });
export const VoiceOutcomeSchema = z.strictObject({
 turnId:RecordIdSchema, disposition:z.enum(["capture","followup","retrieval","conversation","ignore","cancel"]),
 reply:z.string().max(16000).nullable(), capture:CaptureRecordSchema.nullable(),
 targetRootId:RecordIdSchema.nullable(), retrieval:RetrievalSchema.nullable(),
});
export type VoiceOutcome = z.infer<typeof VoiceOutcomeSchema>;
