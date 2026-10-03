import { z } from "zod";
import { AgentModeSchema, RecordIdSchema, TimestampSchema, TimeZoneSchema } from "../domain";
export const ProfileInputSchema = z.strictObject({
 displayName: z.string().trim().min(1).max(100), timeZone: TimeZoneSchema,
});
export const ConversationSchema = z.strictObject({
 id: RecordIdSchema, mode: AgentModeSchema, startedAt: TimestampSchema,
 endedAt: TimestampSchema.nullable(),
}).refine(v => v.endedAt === null || Date.parse(v.endedAt) >= Date.parse(v.startedAt), "Conversation end precedes start");
export const ConversationTurnSchema = z.strictObject({
 id: RecordIdSchema, conversationId: RecordIdSchema, role: z.enum(["user", "assistant"]),
 transcript: z.string().min(1).max(20000), occurredAt: TimestampSchema,
});
export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
