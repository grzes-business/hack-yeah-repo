import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Row } from "./database.types";
import { createIngestionRepository, parseMetricRow, parseEventRow, PartialWriteError } from "./ingestion";
const instant = "2026-10-02T08:00:00.000Z";
const sample = { id: "sample", metric: "hrv", value: 45, unit: "ms", startedAt: instant, endedAt: instant, source: { type: "mock", externalId: "external" } };
function client(failBatch = -1) {
  const batches: { user_id: string; id: string }[][] = [];
  const fake = {
    auth: { async getUser() { return { data: { user: { id: "verified-user" } }, error: null }; } },
    from() { return { async upsert(rows: { user_id: string; id: string }[]) { batches.push(rows); return { error: batches.length === failBatch ? { message: "offline" } : null }; } }; },
  };
  return { batches, repository: createIngestionRepository(fake as unknown as SupabaseClient<Database>) };
}

test("batch writes validate before writing and attach only verified ownership", async () => {
  const { batches, repository } = client();
  await assert.rejects(repository.saveMetrics([sample, { ...sample, id: "bad", value: -1 }]));
  await assert.rejects(repository.saveMetrics([{ ...sample, userId: "forged" }]));
  await assert.rejects(repository.saveMetrics([sample, sample]));
  assert.equal(batches.length, 0);
  assert.equal(await repository.saveMetrics([sample]), 1);
  assert.equal(batches[0][0].user_id, "verified-user");
});

test("partial write failures report confirmed batches and never claim success", async () => {
  const { batches, repository } = client(2);
  const samples = Array.from({ length: 401 }, (_, index) => ({ ...sample, id: `sample-${index}`, source: { type: "mock", externalId: `external-${index}` } }));
  await assert.rejects(repository.saveMetrics(samples), error => error instanceof PartialWriteError && error.confirmed === 200 && error.table === "metric_samples");
  assert.equal(batches.length, 2);
  assert.equal(batches[0].length, 200);
});

test("row reads reject ownership, identity, interval and provenance mismatches", () => {
  const row: Row<"metric_samples"> = { user_id: "owner", id: sample.id, payload: sample, metric: "hrv", source_type: "mock", external_id: "external", started_at: instant, observed_at: instant };
  assert.equal(parseMetricRow(row, "owner").value, 45);
  for (const override of [{ user_id: "other" }, { external_id: "other" }, { started_at: "2026-10-01T00:00:00Z" }]) assert.throws(() => parseMetricRow({ ...row, ...override }, "owner"));
  const event = { id: "event", type: "energy", value: 6, occurredAt: instant, capturedAt: instant, timeZone: "UTC", conversationTurnId: "turn", extractionConfidence: null };
  const eventRow: Row<"subjective_events"> = { user_id: "owner", id: "event", conversation_turn_id: "turn", payload: event, event_type: "energy", observed_at: instant };
  assert.equal(parseEventRow(eventRow, "owner").value, 6);
  assert.throws(() => parseEventRow({ ...eventRow, conversation_turn_id: "other-turn" }, "owner"));
});
