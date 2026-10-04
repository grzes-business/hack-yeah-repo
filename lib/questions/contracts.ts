import { z } from "zod";
import { FeatureSchema, LocalDateSchema, TimestampSchema } from "../domain";
import { InvestigationInputSchema, InvestigationResultSchema } from "../investigation/contracts";
export const QUESTION_POLICY = "questions-v1";
export const QuestionSchema = z.strictObject({feature:FeatureSchema,date:LocalDateSchema,text:z.string().min(1),key:z.string().min(1)});
export type Question = z.infer<typeof QuestionSchema>;
export const PendingAnswerSchema = z.strictObject({id:z.uuid(),text:z.string().trim().min(1).max(2000),turnId:z.string(),at:TimestampSchema,leaseUntil:TimestampSchema});
export const LoopSchema = z.strictObject({
 policy:z.literal(QUESTION_POLICY),id:z.uuid(),input:InvestigationInputSchema,
 before:InvestigationResultSchema,current:InvestigationResultSchema,
 question:QuestionSchema.nullable(),skipped:z.array(z.string()).max(100),resolved:z.array(z.string()).max(100),
 processed:z.array(z.strictObject({id:z.uuid(),text:z.string().max(2000),turnId:z.string()})).max(100),
 stopped:z.boolean(),pending:PendingAnswerSchema.nullable(),needsRefresh:z.boolean(),feedback:z.string().nullable(),
});
export type QuestionLoop = z.infer<typeof LoopSchema>;
export const LoopViewSchema = z.strictObject({revision:z.number().int().nonnegative(),loop:LoopSchema.nullable(),fresh:z.boolean()});
export type LoopView = z.infer<typeof LoopViewSchema>;
const actionBase={revision:z.number().int().nonnegative()};
export const QuestionActionSchema=z.discriminatedUnion("action",[
 z.strictObject({...actionBase,action:z.literal("start"),input:InvestigationInputSchema}),
 z.strictObject({...actionBase,action:z.literal("answer"),answerId:z.uuid(),text:z.string().trim().min(1).max(2000)}),
 z.strictObject({...actionBase,action:z.literal("skip")}),
 z.strictObject({...actionBase,action:z.literal("stop")}),
 z.strictObject({...actionBase,action:z.literal("refresh")}),
]);
export type QuestionAction=z.infer<typeof QuestionActionSchema>;
