import type { SupabaseClient } from "@supabase/supabase-js";
import { createIngestionRepository, parseMetricRow, parseEventRow } from "./ingestion";
import { z } from "zod";
import { DailyFeaturesSchema, MetricSampleSchema, RelationshipResultSchema, SubjectiveEventSchema } from "../domain";
import { ConversationSchema, ConversationTurnSchema, ProfileInputSchema, type Conversation, type ConversationTurn } from "./records";
import type { Database, Json, Row } from "./database.types";

const json = (value: unknown): Json => z.json().parse(value);
function fail(error: { message: string } | null) { if (error) throw new Error(error.message); }
function owner(row: { user_id: string }, userId: string) {
 if (row.user_id !== userId) throw new Error("Record owner does not match the signed-in user.");
}
// Authentication is verified on every operation. Callers cannot choose an owner.
export function createHealthRepository(client: SupabaseClient<Database>) {
 async function userId() {
  const { data, error } = await client.auth.getUser(); fail(error);
  if (!data.user) throw new Error("Start a demo session first.");
  return data.user.id;
 }
 return {
  ...createIngestionRepository(client),
  async ensureProfile(timeZone: string) {
   const id = await userId();
   const input = ProfileInputSchema.parse({ displayName: "Demo participant", timeZone });
   const { error } = await client.from("profiles").upsert({ user_id: id, display_name: input.displayName, time_zone: input.timeZone }, { onConflict: "user_id", ignoreDuplicates: true }); fail(error);
   const result = await client.from("profiles").select("*").eq("user_id", id).single(); fail(result.error);
   if (!result.data) throw new Error("Profile was not returned.");
   owner(result.data, id); ProfileInputSchema.parse({ displayName: result.data.display_name, timeZone: result.data.time_zone }); return result.data;
  },
  async updateProfile(value: unknown) {
   const id = await userId(); const input = ProfileInputSchema.parse(value);
   const result = await client.from("profiles").update({ display_name: input.displayName, time_zone: input.timeZone }).eq("user_id", id).select("*").single(); fail(result.error);
   if (!result.data) throw new Error("Profile was not returned.");
   owner(result.data, id); ProfileInputSchema.parse({ displayName: result.data.display_name, timeZone: result.data.time_zone }); return result.data;
  },
  async saveMetric(value: unknown) {
   const id = await userId(); const record = MetricSampleSchema.parse(value);
   const { error } = await client.from("metric_samples").upsert({ user_id: id, id: record.id, payload: json(record), started_at: record.startedAt, observed_at: record.endedAt }, { onConflict: "user_id,id" }); fail(error);
   return record;
  },
  async saveEvent(value: unknown) {
   const id = await userId(); const record = SubjectiveEventSchema.parse(value);
   const { error } = await client.from("subjective_events").upsert({ user_id: id, id: record.id, conversation_turn_id: record.conversationTurnId, payload: json(record), observed_at: record.occurredAt }, { onConflict: "user_id,id" }); fail(error);
   return record;
  },
  async saveConversation(value: Conversation) {
   const id = await userId(); const record = ConversationSchema.parse(value);
   const { error } = await client.from("conversations").upsert({ user_id: id, id: record.id, mode: record.mode, started_at: record.startedAt, ended_at: record.endedAt }, { onConflict: "user_id,id" }); fail(error); return record;
  },
  async saveTurn(value: ConversationTurn) {
   const id = await userId(); const record = ConversationTurnSchema.parse(value);
   const { error } = await client.from("conversation_turns").upsert({ user_id: id, id: record.id, conversation_id: record.conversationId, role: record.role, transcript: record.transcript, occurred_at: record.occurredAt }, { onConflict: "user_id,id" }); fail(error); return record;
  },
  async listConversations() {
   const id = await userId(); const { data, error } = await client.from("conversations").select("*").eq("user_id", id).order("started_at", { ascending: false }).limit(100); fail(error);
   return (data ?? []).map(row => { owner(row, id); return ConversationSchema.parse({ id: row.id, mode: row.mode, startedAt: new Date(row.started_at).toISOString(), endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null }); });
  },
  async listTurns(conversationId: string) {
   const id = await userId();
   const { data, error } = await client.from("conversation_turns").select("*").eq("user_id", id).eq("conversation_id", conversationId).order("occurred_at").limit(500); fail(error);
   return (data ?? []).map(row => { owner(row, id); return ConversationTurnSchema.parse({ id: row.id, conversationId: row.conversation_id, role: row.role, transcript: row.transcript, occurredAt: new Date(row.occurred_at).toISOString() }); });
  },
  async listObservations() {
   const id = await userId();
   // Bound the initial UI read; ingestion/range pagination belongs to Stage 2.
   const [metrics, events] = await Promise.all([
    client.from("metric_samples").select("*").eq("user_id", id).order("observed_at", { ascending: false }).limit(500),
    client.from("subjective_events").select("*").eq("user_id", id).order("observed_at", { ascending: false }).limit(500),
   ]); fail(metrics.error); fail(events.error);
   return {
    metrics: (metrics.data ?? []).map(row => parseMetricRow(row, id)),
    events: (events.data ?? []).map(row => parseEventRow(row, id)),
   };
  },
  async listDailyFeatures() {
   const id = await userId(); const { data, error } = await client.from("daily_features").select("*").eq("user_id", id).order("date", { ascending: false }).limit(100); fail(error);
   return (data ?? []).map(row => { owner(row, id); const v = DailyFeaturesSchema.parse(row.payload); if (v.userId !== id || v.date !== row.date || v.timeZone !== row.time_zone || v.builderVersion !== row.builder_version) throw new Error("Daily feature metadata mismatch."); return v; });
  },
  async listRelationshipResults() {
   const id = await userId(); const { data, error } = await client.from("relationship_results").select("*").eq("user_id", id).order("period_to", { ascending: false }).limit(100); fail(error);
   return (data ?? []).map(row => { owner(row, id); const v = RelationshipResultSchema.parse(row.payload); if (v.userId !== id || v.relationshipId !== row.relationship_id || v.analysisVersion !== row.analysis_version || v.period.from !== row.period_from || v.period.to !== row.period_to) throw new Error("Relationship metadata mismatch."); return v; });
  },
 };
}
export type HealthRepository = ReturnType<typeof createHealthRepository>;
export type Profile = Row<"profiles">;
