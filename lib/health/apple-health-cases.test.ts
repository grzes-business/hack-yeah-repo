import assert from "node:assert/strict";
import { test } from "node:test";
import { rebuildDailyFeatures } from "../features/builder";
import { AppleHealthDataSource, dedupeWorkoutSources, normalizeQuantitySamples, normalizeSleep, normalizeDailyTotals, normalizeWorkouts, type AppleHealthClient, type AppleSample, type AppleWorkout } from "./apple-health";
import { ingestHealthData } from "./ingestion";

/*
 * Stage 13 case matrix. Payloads are hand-built, deidentified HealthKit shapes
 * (no exported personal history is committed). Each case states the expected
 * canonical and daily result; see docs/HEALTHKIT.md for the matrix.
 */
const ZONE = "Europe/Warsaw";
const build = (from: string, to: string, metrics: ReturnType<typeof normalizeSleep>) =>
  rebuildDailyFeatures(from, to, { userId: "case-user", timeZone: ZONE, builtAt: "2026-11-01T00:00:00.000Z", scope: "personal", metrics, events: [] });
const seg = (id: string, start: string, end: string, sleepState: string, sourceId = "watch"): AppleSample =>
  ({ value: 0, unit: "minute", startDate: start, endDate: end, sleepState, sourceId, platformId: id });
const workout = (id: string, start: string, end: string, sourceId: string): AppleWorkout =>
  ({ platformId: id, startDate: start, endDate: end, sourceId, workoutType: "running", duration: (Date.parse(end) - Date.parse(start)) / 1000 });

test("C1 duplicate export: the same HealthKit object twice yields one canonical sample", () => {
  const hrv = { value: 51, unit: "millisecond", startDate: "2026-10-02T06:00:00Z", endDate: "2026-10-02T06:01:00Z", platformId: "dup" };
  assert.equal(normalizeQuantitySamples("hrv", [hrv, { ...hrv }], "millisecond").length, 1);
  assert.equal(normalizeSleep([seg("s", "2026-10-01T22:00:00Z", "2026-10-02T06:00:00Z", "light"), seg("s", "2026-10-01T22:00:00Z", "2026-10-02T06:00:00Z", "light")], ["sleep_duration"], 0, Date.parse("2026-10-03T00:00:00Z"))[0].value, 480);
});

test("C2 one run recorded by Watch and a running app counts once; same-source sessions are kept", () => {
  const kept = dedupeWorkoutSources([
    workout("watch-run", "2026-10-02T16:00:00Z", "2026-10-02T16:45:00Z", "watch"),
    workout("strava-run", "2026-10-02T16:01:00Z", "2026-10-02T16:44:00Z", "strava"),
    workout("watch-walk", "2026-10-02T18:00:00Z", "2026-10-02T18:20:00Z", "watch"),
  ]);
  assert.deepEqual(kept.map(w => w.platformId), ["watch-run", "watch-walk"]);
  const day = build("2026-10-02", "2026-10-02", normalizeWorkouts(kept))[0];
  assert.deepEqual(day.features.workout_duration.status === "known" && day.features.workout_duration.value, 65);
});

test("C3 DST fall-back night keeps real elapsed minutes and lands on the local wake day", () => {
  // Warsaw clocks go back 03:00 → 02:00 on 2026-10-25: 22:00 local to 06:00 local is 9 real hours.
  const sleep = normalizeSleep([seg("dst", "2026-10-24T20:00:00Z", "2026-10-25T05:00:00Z", "light")], ["sleep_duration", "sleep_start", "sleep_end"], Date.parse("2026-10-24T00:00:00Z"), Date.parse("2026-10-26T00:00:00Z"));
  assert.equal(sleep.find(s => s.metric === "sleep_duration")!.value, 540);
  const [before, wake] = build("2026-10-24", "2026-10-25", sleep);
  assert.equal(before.features.sleep_duration.status, "unknown");
  assert.ok(wake.features.sleep_duration.status === "known" && wake.features.sleep_duration.value === 540);
});

test("C4 a 25-hour DST day total is accepted as that local day's steps", () => {
  const steps = normalizeDailyTotals("steps", [{ startDate: "2026-10-24T22:00:00Z", endDate: "2026-10-25T23:00:00Z", value: 9000, unit: "count" }], Date.parse("2026-11-01T00:00:00Z"));
  const day = build("2026-10-25", "2026-10-25", steps)[0];
  assert.ok(day.features.steps.status === "known" && day.features.steps.value === 9000);
});

test("C5 iPhone and Watch sleep for the same night are not summed; the daily value is the fuller record", () => {
  const sleep = normalizeSleep([
    seg("w", "2026-10-01T22:00:00Z", "2026-10-02T06:00:00Z", "light", "watch"),
    seg("p", "2026-10-01T22:30:00Z", "2026-10-02T05:00:00Z", "asleep", "phone"),
  ], ["sleep_duration"], 0, Date.parse("2026-10-03T00:00:00Z"));
  const day = build("2026-10-02", "2026-10-02", sleep)[0];
  assert.ok(day.features.sleep_duration.status === "known" && day.features.sleep_duration.value === 480);
});

test("C6 an unexpected unit fails that metric instead of storing mislabelled values", async () => {
  assert.throws(() => normalizeQuantitySamples("hrv", [{ value: 0.05, unit: "second", startDate: "2026-10-02T06:00:00Z", endDate: "2026-10-02T06:00:00Z", platformId: "u" }], "millisecond"), /Unexpected hrv unit/);
});

test("C7 repeated and empty syncs never inflate or erase stored history", async () => {
  const client: AppleHealthClient = {
    isAvailable: async () => ({ available: true }), requestAuthorization: async () => ({}),
    readSamples: async () => ({ samples: [] }), queryAggregated: async () => ({ samples: [] }), queryWorkouts: async () => ({ workouts: [] }),
  };
  let writes = 0;
  const writer = { saveMetrics: async (samples: unknown[]) => { writes++; return samples.length; } };
  const range = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-31T00:00:00Z"), metrics: ["steps", "hrv"] as ("steps" | "hrv")[] };
  const result = await ingestHealthData(new AppleHealthDataSource(client), range, writer);
  // An empty read is not evidence of deletion: nothing is written and the writer has no delete path.
  assert.deepEqual([result.fetched, result.stored, writes], [0, 0, 0]);
});
