import { ConversationTurnSchema, type ConversationTurn } from "../db/records";

export type TranscriptUpdate = { key: string; role: "user" | "assistant"; text: string; final: boolean; turn?: ConversationTurn };
// Only transcript events are accepted. Provider tool calls never become app actions.
export function readTranscriptEvent(value: unknown, conversationId: string, occurredAt: string): TranscriptUpdate | null {
 if (!value || typeof value !== "object") return null;
 const event = value as Record<string, unknown>;
 if (typeof event.item_id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(event.item_id)) return null;
 const user = event.type === "conversation.item.input_audio_transcription.completed" || event.type === "conversation.item.input_audio_transcription.delta";
 const assistant = event.type === "response.output_audio_transcript.done" || event.type === "response.output_audio_transcript.delta";
 if (!user && !assistant) return null;
 const final = event.type === "conversation.item.input_audio_transcription.completed" || event.type === "response.output_audio_transcript.done";
 const text = final ? event.transcript : event.delta;
 if (typeof text !== "string" || text.length > 20000) return null;
 const role = user ? "user" : "assistant";
 const part = Number.isSafeInteger(event.content_index) && (event.content_index as number) >= 0 ? event.content_index : 0;
 const key = `${conversationId}:${role}:${event.item_id}:${part}`;
 if (!final) return { key, role, text, final };
 if (!text.trim()) return null;
 const parsed = ConversationTurnSchema.safeParse({ id: key, conversationId, role, transcript: text, occurredAt });
 return parsed.success ? { key, role, text, final, turn: parsed.data } : null;
}
