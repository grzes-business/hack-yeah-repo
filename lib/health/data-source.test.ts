import assert from "node:assert/strict";
import { test } from "node:test";
import { HealthDataSourceRequestSchema, parseHealthDataSourceResponse, type HealthDataSource } from "./data-source";

const request = { from: new Date("2026-10-03T00:00:00Z"), to: new Date("2026-10-04T00:00:00Z"), metrics: ["hrv"] as ["hrv"] };
const sample = { id: "sample-1", metric: "hrv", value: 40, unit: "ms", startedAt: "2026-10-03T00:00:00Z", endedAt: "2026-10-03T00:00:00Z", source: { type: "mock", externalId: "external-1" } };

test("source queries require valid increasing Date instants and unique registered metrics", () => {
  assert.equal(HealthDataSourceRequestSchema.safeParse(request).success, true);
  for (const override of [{ from: request.to }, { from: new Date(NaN) }, { metrics: [] }, { metrics: ["hrv", "hrv"] }, { metrics: ["invented"] }, { from: "2026-10-03T00:00:00Z" }]) {
    assert.equal(HealthDataSourceRequestSchema.safeParse({ ...request, ...override }).success, false);
  }
});

test("half-open source ranges include start, exclude end, and allow overlapping intervals", () => {
  assert.equal(parseHealthDataSourceResponse(request, [sample]).length, 1);
  assert.equal(parseHealthDataSourceResponse(request, [{ ...sample, startedAt: "2026-10-02T23:00:00Z", endedAt: "2026-10-03T01:00:00Z" }]).length, 1);
  for (const override of [
    { startedAt: "2026-10-04T00:00:00Z", endedAt: "2026-10-04T00:00:00Z" },
    { startedAt: "2026-10-02T23:00:00Z", endedAt: "2026-10-03T00:00:00Z" },
    { metric: "resting_hr", unit: "bpm" },
  ]) assert.throws(() => parseHealthDataSourceResponse(request, [{ ...sample, ...override }]));
  assert.throws(() => parseHealthDataSourceResponse(request, [sample, sample]));
});

test("source contract supports empty and canonical responses without storage or framework code", async () => {
  const source: HealthDataSource = {
    async getSamples(args) { return parseHealthDataSourceResponse(args, [sample]); },
  };
  assert.equal((await source.getSamples(request))[0].metric, "hrv");
  assert.deepEqual(parseHealthDataSourceResponse(request, []), []);
});
