import assert from "node:assert/strict";
import { test } from "node:test";
import { Metrics, MetricSampleSchema } from "../domain";
import { AppleHealthDataSource, buildSleepSessions, normalizeDailyTotals, type AppleHealthClient, type AppleSample } from "./apple-health";
import { ingestHealthData } from "./ingestion";

const seg = (id: string, start: string, end: string, sleepState: string, sourceId = "com.apple.health.watch"): AppleSample =>
  ({ value: (Date.parse(end) - Date.parse(start)) / 60000, unit: "minute", startDate: start, endDate: end, sleepState, sourceId, sourceName: "Test Watch", platformId: id });

// Night of Oct 1→2 (UTC): watch stages with a short awake gap, plus an overlapping
// iPhone "asleep" estimate and a separate afternoon nap.
const sleepSegments: AppleSample[] = [
  seg("w1", "2026-10-01T22:00:00Z", "2026-10-02T01:00:00Z", "light"),
  seg("w2", "2026-10-02T01:00:00Z", "2026-10-02T02:00:00Z", "deep"),
  seg("w3", "2026-10-02T02:00:00Z", "2026-10-02T02:20:00Z", "awake"),
  seg("w4", "2026-10-02T02:20:00Z", "2026-10-02T06:00:00Z", "rem"),
  seg("p1", "2026-10-01T22:30:00Z", "2026-10-02T05:00:00Z", "asleep", "com.apple.health.phone"),
  seg("b1", "2026-10-01T21:45:00Z", "2026-10-02T06:10:00Z", "inBed", "com.apple.health.phone"),
  seg("n1", "2026-10-02T13:00:00Z", "2026-10-02T13:40:00Z", "asleep"),
];

function fakeClient(overrides: Partial<AppleHealthClient> = {}): AppleHealthClient {
  return {
    isAvailable: async () => ({ available: true }),
    requestAuthorization: async () => ({}),
    readSamples: async ({ dataType }) => ({
      samples: dataType === "sleep" ? sleepSegments
        : dataType === "heartRateVariability" ? [{ value: 48.2, unit: "millisecond", startDate: "2026-10-02T06:30:00Z", endDate: "2026-10-02T06:31:00Z", platformId: "h1", sourceName: "Test Watch" }]
        : dataType === "restingHeartRate" ? [{ value: 54, unit: "bpm", startDate: "2026-10-02T00:00:00Z", endDate: "2026-10-02T23:59:00Z", platformId: "r1" }]
        : [],
    }),
    queryAggregated: async ({ dataType }) => ({
      samples: dataType === "steps"
        ? [{ startDate: "2026-10-01T22:00:00Z", endDate: "2026-10-02T22:00:00Z", value: 8123.6, unit: "count" }]
        : [],
    }),
    queryWorkouts: async () => ({ workouts: [{ duration: 2700, startDate: "2026-10-02T16:00:00Z", endDate: "2026-10-02T16:45:00Z", workoutType: "running", platformId: "wk1" }] }),
    ...overrides,
  };
}
const request = { from: new Date("2026-10-01T22:00:00Z"), to: new Date("2026-10-02T22:00:00Z"), metrics: Object.values(Metrics) };
const now = () => Date.parse("2026-10-03T12:00:00Z");

test("sleep stages become one session per night; awake/in-bed excluded and overlapping sources not summed", () => {
  const sessions = buildSleepSessions(sleepSegments);
  assert.equal(sessions.length, 2);
  const night = sessions[0];
  assert.equal(night.source, "com.apple.health.watch");
  assert.equal(new Date(night.start).toISOString(), "2026-10-01T22:00:00.000Z");
  assert.equal(new Date(night.end).toISOString(), "2026-10-02T06:00:00.000Z");
  assert.equal(night.minutes, 460); // 8h minus the 20-minute awake gap
  assert.equal(sessions[1].minutes, 40); // separate nap, beyond the 90-minute gap
});

test("normalized samples satisfy the shared contract with SDNN ms, bpm and stable Apple IDs", async () => {
  const source = new AppleHealthDataSource(fakeClient(), now);
  const samples = await source.getSamples(request);
  for (const s of samples) assert.ok(MetricSampleSchema.safeParse(s).success, s.id);
  const hrv = samples.find(s => s.metric === "hrv")!;
  assert.deepEqual([hrv.value, hrv.unit, hrv.id, hrv.source.type, hrv.source.externalId], [48.2, "ms", "apple_health:hrv:h1", "apple_health", "h1"]);
  const duration = samples.find(s => s.metric === "sleep_duration")!;
  const start = samples.find(s => s.metric === "sleep_start")!, end = samples.find(s => s.metric === "sleep_end")!;
  assert.equal(duration.value, 460);
  assert.equal(start.value, duration.startedAt);
  assert.equal(end.value, duration.endedAt);
  assert.equal(start.sessionId, duration.sessionId);
  assert.equal(samples.find(s => s.metric === "steps")!.value, 8124);
  assert.equal(samples.find(s => s.metric === "workout_duration")!.value, 45);
  assert.deepEqual(await new AppleHealthDataSource(fakeClient(), now).getSamples(request), samples);
});

test("missing data stays unknown: no records, unsupported and failed metrics are reported, never zero", async () => {
  const source = new AppleHealthDataSource(fakeClient({ queryWorkouts: async () => { throw new Error("Authorization not determined"); } }), now);
  const samples = await source.getSamples(request);
  assert.equal(samples.some(s => s.metric === "active_energy" || s.metric === "workout_duration" || s.metric === "workout_avg_hr"), false);
  const status = Object.fromEntries(source.lastReport.map(r => [r.metric, r.status]));
  assert.deepEqual([status.active_energy, status.workout_duration, status.workout_avg_hr, status.hrv], ["no_records", "failed", "unsupported", "records"]);
});

test("only requested metrics are returned and the current day is not presented as complete", async () => {
  const samples = await new AppleHealthDataSource(fakeClient(), now).getSamples({ ...request, metrics: ["steps", "hrv"] });
  assert.deepEqual(new Set(samples.map(s => s.metric)), new Set(["steps", "hrv"]));
  const partial = normalizeDailyTotals("steps", [{ startDate: "2026-10-03T00:00:00Z", endDate: "2026-10-04T00:00:00Z", value: 10, unit: "count" }], now());
  assert.equal(partial[0].endedAt, "2026-10-03T12:00:00.000Z");
  assert.equal(normalizeDailyTotals("steps", [{ startDate: "2026-10-04T00:00:00Z", endDate: "2026-10-05T00:00:00Z", value: 10, unit: "count" }], now()).length, 0);
});

test("re-syncing the same range writes the same IDs (idempotent upsert)", async () => {
  const saved: string[][] = [];
  const writer = { saveMetrics: async (samples: { id: string }[]) => { saved.push(samples.map(s => s.id)); return samples.length; } };
  await ingestHealthData(new AppleHealthDataSource(fakeClient(), now), request, writer);
  await ingestHealthData(new AppleHealthDataSource(fakeClient(), now), request, writer);
  assert.deepEqual(saved[0], saved[1]);
});

test("a HealthKit read that never answers is reported as failed instead of hanging the sync", async () => {
  const steps: string[] = [];
  const hanging = fakeClient({ readSamples: ({ dataType }) => dataType === "heartRateVariability" ? new Promise(() => {}) : fakeClient().readSamples({ dataType, startDate: "", endDate: "", limit: 1, ascending: true }) });
  const source = new AppleHealthDataSource(hanging, now, label => steps.push(label), 20);
  const samples = await source.getSamples(request);
  assert.equal(samples.some(s => s.metric === "hrv"), false);
  const failed = source.lastReport.find(r => r.metric === "hrv");
  assert.ok(failed?.status === "failed" && /did not answer/.test(failed.reason));
  assert.ok(samples.some(s => s.metric === "steps"));
  assert.deepEqual(steps, ["HRV (SDNN)", "Resting heart rate", "Sleep", "Steps", "Active energy", "Workout duration"]);
});
