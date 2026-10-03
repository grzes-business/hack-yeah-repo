import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { MetricSampleSchema, SubjectiveEventSchema } from "../domain";
import { DemoOptionsSchema, demoNamespace, type DemoOptions } from "../demo/scenario";
import { HealthDataSourceRequestSchema, parseHealthDataSourceResponse, type HealthDataSourceRequest } from "../health/data-source";
import { ConversationSchema, ConversationTurnSchema } from "./records";
import type { Database, Json, Row } from "./database.types";

const BATCH_SIZE = 200;
const PAGE_SIZE = 250;
// Optional undefined fields are omitted when writing JSON, after schema validation.
const json = (value: unknown): Json => z.json().parse(JSON.parse(JSON.stringify(value)));
const rangeSchema = z.strictObject({ from: z.date(), to: z.date() })
  .refine(v => v.from.getTime() < v.to.getTime(), "Range end must follow start");
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };
const likePrefix = (prefix: string) => prefix.replace(/[\\%_]/g, "\\$&") + "%";

export class PartialWriteError extends Error {
  constructor(public readonly table: string, public readonly confirmed: number, cause: string) {
    super(`${table}: ${confirmed} records confirmed before a batch failed. Retry the same input. ${cause}`);
    this.name = "PartialWriteError";
  }
}
export function parseMetricRow(row: Row<"metric_samples">, userId: string) {
  const sample = MetricSampleSchema.parse(row.payload);
  if (row.user_id !== userId || sample.id !== row.id || sample.metric !== row.metric
    || sample.source.type !== row.source_type || sample.source.externalId !== row.external_id
    || Date.parse(sample.startedAt) !== Date.parse(row.started_at)
    || Date.parse(sample.endedAt) !== Date.parse(row.observed_at)) {
    throw new Error("Metric ownership or metadata mismatch.");
  }
  return sample;
}
export function parseEventRow(row: Row<"subjective_events">, userId: string) {
  const event = SubjectiveEventSchema.parse(row.payload);
  if (row.user_id !== userId || event.id !== row.id || event.type !== row.event_type
    || event.conversationTurnId !== row.conversation_turn_id
    || Date.parse(event.occurredAt) !== Date.parse(row.observed_at)) {
    throw new Error("Event ownership or provenance mismatch.");
  }
  return event;
}
function uniqueIds(records: { id: string }[]) {
  if (new Set(records.map(r => r.id)).size !== records.length) throw new Error("Duplicate IDs in write batch.");
}
async function writeBatches<T>(table: string, rows: T[], write: (batch: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  let confirmed = 0;
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    try { const { error } = await write(batch); fail(error); }
    catch (error) { throw new PartialWriteError(table, confirmed, error instanceof Error ? error.message : "Storage unavailable"); }
    confirmed += batch.length;
  }
  return confirmed;
}

export function createIngestionRepository(client: SupabaseClient<Database>) {
  async function userId() {
    const { data, error } = await client.auth.getUser(); fail(error);
    if (!data.user) throw new Error("Start a demo session first.");
    return data.user.id;
  }
  return {
    async saveMetrics(input: unknown) {
      const samples = z.array(MetricSampleSchema).parse(input); uniqueIds(samples);
      const identities = samples.map(s => JSON.stringify([s.source.type, s.source.externalId, s.metric]));
      if (new Set(identities).size !== identities.length) throw new Error("Duplicate source identities in write batch.");
      const id = await userId();
      const rows = samples.map(s => ({ user_id: id, id: s.id, payload: json(s), started_at: s.startedAt, observed_at: s.endedAt }));
      return writeBatches("metric_samples", rows, batch => client.from("metric_samples").upsert(batch, { onConflict: "user_id,id" }));
    },
    async saveConversations(input: unknown) {
      const records = z.array(ConversationSchema).parse(input); uniqueIds(records); const id = await userId();
      const rows = records.map(v => ({ user_id: id, id: v.id, mode: v.mode, started_at: v.startedAt, ended_at: v.endedAt }));
      return writeBatches("conversations", rows, batch => client.from("conversations").upsert(batch, { onConflict: "user_id,id" }));
    },
    async saveTurns(input: unknown) {
      const records = z.array(ConversationTurnSchema).parse(input); uniqueIds(records); const id = await userId();
      const rows = records.map(v => ({ user_id: id, id: v.id, conversation_id: v.conversationId, role: v.role, transcript: v.transcript, occurred_at: v.occurredAt }));
      return writeBatches("conversation_turns", rows, batch => client.from("conversation_turns").upsert(batch, { onConflict: "user_id,id" }));
    },
    async saveEvents(input: unknown) {
      const records = z.array(SubjectiveEventSchema).parse(input); uniqueIds(records); const id = await userId();
      const rows = records.map(v => ({ user_id: id, id: v.id, conversation_turn_id: v.conversationTurnId, payload: json(v), observed_at: v.occurredAt }));
      return writeBatches("subjective_events", rows, batch => client.from("subjective_events").upsert(batch, { onConflict: "user_id,id" }));
    },
    async readMetricSamples(request: HealthDataSourceRequest) {
      const args = HealthDataSourceRequestSchema.parse(request), id = await userId();
      const from = args.from.toISOString(), to = args.to.toISOString();
      const samples = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        // A nonzero interval ending at `from` does not overlap; an instant at
        // `from` does. PostgreSQL's timestamp columns preserve that distinction.
        const result = await client.from("metric_samples").select("*").eq("user_id", id)
          .in("metric", args.metrics).lt("started_at", to)
          .or(`observed_at.gt.${from},and(started_at.eq.${from},observed_at.eq.${from})`)
          .order("observed_at").order("id").range(offset, offset + PAGE_SIZE - 1);
        fail(result.error); const page = result.data ?? [];
        samples.push(...page.map(row => parseMetricRow(row, id)));
        if (page.length < PAGE_SIZE) break;
      }
      return parseHealthDataSourceResponse(args, samples);
    },
    async readSubjectiveEvents(request: { from: Date; to: Date }) {
      const args = rangeSchema.parse(request), id = await userId();
      const events = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const result = await client.from("subjective_events").select("*").eq("user_id", id)
          .gte("observed_at", args.from.toISOString()).lt("observed_at", args.to.toISOString())
          .order("observed_at").order("id").range(offset, offset + PAGE_SIZE - 1);
        fail(result.error); const page = result.data ?? [];
        events.push(...page.map(row => parseEventRow(row, id)));
        if (page.length < PAGE_SIZE) break;
      }
      if (new Set(events.map(v => v.id)).size !== events.length) throw new Error("History changed during read; retry.");
      return events;
    },
    async removeDemoHistory(input: DemoOptions) {
      const options = DemoOptionsSchema.parse(input), id = await userId();
      const prefix = likePrefix(demoNamespace(options));
      // Restrict cleanup to this owner's reserved version/seed/zone namespace.
      fail((await client.from("metric_samples").delete().eq("user_id", id).eq("source_type", "mock").like("id", prefix).like("external_id", prefix)).error);
      fail((await client.from("conversations").delete().eq("user_id", id).like("id", prefix)).error);
      // FK cascade removes only the fixture turns/events linked to these sessions.
      const [metrics, conversations] = await Promise.all([
        client.from("metric_samples").select("id").eq("user_id", id).eq("source_type", "mock").like("id", prefix).limit(1),
        client.from("conversations").select("id").eq("user_id", id).like("id", prefix).limit(1),
      ]);
      fail(metrics.error); fail(conversations.error);
      if (metrics.data?.length || conversations.data?.length) throw new Error("Sample removal was incomplete. Retry.");
    },
  };
}
