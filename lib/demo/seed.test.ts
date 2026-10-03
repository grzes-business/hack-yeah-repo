import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { MetricSampleSchema, SubjectiveEventSchema } from "../domain";
import { ConversationSchema, ConversationTurnSchema } from "../db/records";
import { createHealthRepository } from "../db/repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types";
import { seedDemoHistory } from "./seed";
const options = { endDate: "2026-10-02", timeZone: "Europe/Warsaw", days: 56, seed: 2026 };

test("seeding validates separate fixture paths and replays stable identities without duplicates", async () => {
  const calls: string[] = [];
  const metrics = new Map(), conversations = new Map(), turns = new Map(), events = new Map();
  const repository = {
    async saveMetrics(input: unknown) { calls.push("metrics"); const values = z.array(MetricSampleSchema).parse(input); for (const v of values) metrics.set(v.id, v); return values.length; },
    async saveConversations(input: unknown) { calls.push("conversations"); const values = z.array(ConversationSchema).parse(input); for (const v of values) conversations.set(v.id, v); return values.length; },
    async saveTurns(input: unknown) { calls.push("turns"); const values = z.array(ConversationTurnSchema).parse(input); for (const v of values) { assert.ok(conversations.has(v.conversationId)); turns.set(v.id, v); } return values.length; },
    async saveEvents(input: unknown) { calls.push("events"); const values = z.array(SubjectiveEventSchema).parse(input); for (const v of values) { assert.ok(turns.has(v.conversationTurnId)); events.set(v.id, v); } return values.length; },
  };
  const first = await seedDemoHistory(repository, options);
  const second = await seedDemoHistory(repository, options);
  assert.deepEqual(first, second);
  assert.equal(metrics.size, first.metrics); assert.equal(events.size, first.events);
  assert.equal(conversations.size, 56); assert.equal(turns.size, 56);
  assert.deepEqual(calls.slice(0, 4), ["metrics", "conversations", "turns", "events"]);
  await assert.rejects(seedDemoHistory({ ...repository, async saveEvents() { throw new Error("Offline"); } }, options));
});

test("repository rejects absent verified authentication before persisting records", async () => {
  let databaseCalls = 0;
  const client = {
    auth: { async getUser() { return { data: { user: null }, error: null }; } },
    from() { databaseCalls++; throw new Error("Unexpected database call"); },
  } as unknown as SupabaseClient<Database>;
  await assert.rejects(createHealthRepository(client).ensureProfile("UTC"), /Start a demo session/);
  assert.equal(databaseCalls, 0);
});
