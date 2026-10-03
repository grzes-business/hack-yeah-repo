import assert from "node:assert/strict";
import { test } from "node:test";
import { Metrics, MetricSampleSchema, SubjectiveEventSchema, addCalendarDays, getLocalDate } from "../domain";
import { DemoOptionsSchema, demoRange, scenarioDays, localInstant } from "../demo/scenario";
import { createSubjectiveFixtures } from "../demo/subjective-fixtures";
import { MockHealthDataSource } from "./mock-data-source";
import { ingestHealthData } from "./ingestion";
const options = DemoOptionsSchema.parse({ endDate: "2026-10-02", timeZone: "Europe/Warsaw" });
const request = { ...demoRange(options), metrics: Object.values(Metrics) };

test("56-day fixtures reproduce canonical values/IDs and include all registered inputs", async () => {
  const a = await new MockHealthDataSource(options).getSamples(request);
  assert.deepEqual(a, await new MockHealthDataSource(options).getSamples(request));
  assert.equal(new Set(a.map(v => v.id)).size, a.length);
  assert.deepEqual(new Set(a.map(v => v.metric)), new Set(Object.values(Metrics)));
  for (const sample of a) assert.ok(MetricSampleSchema.safeParse(sample).success);
  assert.notDeepEqual(a, await new MockHealthDataSource({ ...options, seed: 123 }).getSamples(request));
  const subjective = createSubjectiveFixtures(options);
  assert.deepEqual(subjective, createSubjectiveFixtures(options));
  assert.equal(subjective.conversations.length, 56);
  assert.equal(subjective.turns.length, 56);
  assert.equal(new Set(subjective.events.map(v => v.type)).size, 10);
  for (const event of subjective.events) {
    assert.ok(SubjectiveEventSchema.safeParse(event).success);
    assert.ok(subjective.turns.some(v => v.id === event.conversationTurnId));
    assert.equal(event.extractionConfidence, null);
  }
});

test("overlapping fixture windows retain source identity and values", async () => {
  const subset = DemoOptionsSchema.parse({ ...options, days: 7 });
  const subsetRequest = { ...demoRange(subset), metrics: Object.values(Metrics) };
  assert.deepEqual(await new MockHealthDataSource(options).getSamples(subsetRequest), await new MockHealthDataSource(subset).getSamples(subsetRequest));
});

test("fixture omissions remain absent, unknown doses remain null, and absence stays explicit", async () => {
  const metrics = await new MockHealthDataSource(options).getSamples(request);
  const { events } = createSubjectiveFixtures(options);
  const eventDates = events.map(v => ({ value: v, date: getLocalDate(v.occurredAt, options.timeZone) }));
  const metricDates = metrics.map(v => ({ value: v, date: getLocalDate(v.endedAt, options.timeZone) }));
  for (const day of scenarioDays(options)) {
    const dayEvents = eventDates.filter(v => v.date === day.date).map(v => v.value);
    const dayMetrics = metricDates.filter(v => v.date === day.date).map(v => v.value);
    assert.equal(dayEvents.some(v => v.type === "energy"), !day.omitEnergy);
    assert.equal(dayEvents.some(v => v.type === "stress"), !day.omitStress);
    assert.equal(dayEvents.some(v => v.type === "alcohol"), !day.omitAlcohol);
    assert.equal(dayMetrics.some(v => v.metric === "hrv"), !day.omitHrv);
    assert.equal(dayMetrics.some(v => v.metric === "sleep_duration"), !day.omitSleep);
    assert.equal(dayEvents.some(v => v.type === "workout_rpe"), day.workoutRpe !== null);
    assert.equal(dayMetrics.some(v => v.metric === "workout_duration"), day.workoutRpe !== null);
  }
  assert.ok(events.some(v => v.type === "caffeine" && v.value.consumed && v.value.amountMg === null));
  assert.ok(events.some(v => v.type === "alcohol" && !v.value.consumed && v.value.quantity === 0));
  assert.ok(events.some(v => v.type === "illness" && v.value === false));
});

test("fixture wall clocks and full sleep intervals survive both DST transitions", async () => {
  for (const endDate of ["2026-03-31", "2026-10-27"]) {
    const args = DemoOptionsSchema.parse({ ...options, endDate, days: 7 });
    const samples = await new MockHealthDataSource(args).getSamples({ ...demoRange(args), metrics: Object.values(Metrics) });
    for (const sample of samples) {
      if (sample.metric === "sleep_duration") assert.equal((Date.parse(sample.endedAt) - Date.parse(sample.startedAt)) / 60000, sample.value);
      if (sample.metric === "sleep_start" || sample.metric === "sleep_end") assert.equal(sample.sessionId?.includes(getLocalDate(sample.endedAt, args.timeZone)), true);
    }
  }
  assert.equal(localInstant("2026-03-29", 7, 30, "Europe/Warsaw"), "2026-03-29T05:30:00.000Z");
  assert.equal(localInstant("2026-10-25", 7, 30, "Europe/Warsaw"), "2026-10-25T06:30:00.000Z");
  assert.throws(() => localInstant("2026-03-29", 2, 30, "Europe/Warsaw"));
});

test("mock adapter applies metric selection and half-open overlap rather than clipping", async () => {
  const source = new MockHealthDataSource(options);
  const all = await source.getSamples(request);
  const sleep = all.find(v => v.metric === "sleep_duration")!;
  const inside = new Date(Date.parse(sleep.startedAt) + 60000);
  const result = await source.getSamples({ from: inside, to: new Date(sleep.endedAt), metrics: ["sleep_duration"] });
  assert.equal(result[0].startedAt, sleep.startedAt);
  const hrv = all.find(v => v.metric === "hrv")!;
  assert.deepEqual(await source.getSamples({ from: new Date(Date.parse(hrv.endedAt) - 60000), to: new Date(hrv.endedAt), metrics: ["hrv"] }), []);
  assert.deepEqual(await source.getSamples({ from: new Date("2030-01-01T00:00:00Z"), to: new Date("2030-01-02T00:00:00Z"), metrics: ["hrv"] }), []);
  await assert.rejects(source.getSamples({ ...request, metrics: ["hrv", "hrv"] }));
  assert.throws(() => new MockHealthDataSource({ ...options, days: 61 }));
});

test("fixture ground truth contains lower HRV after prior-day alcohol and explicit factor lags", () => {
  const days = scenarioDays(options);
  const mean = (values: number[]) => values.reduce((a,b) => a+b, 0) / values.length;
  const exposed = days.filter(v => v.previousAlcohol && !v.illness).map(v => v.hrv);
  const control = days.filter(v => !v.previousAlcohol && !v.illness).map(v => v.hrv);
  assert.ok(exposed.length >= 5 && control.length >= 5);
  assert.ok(mean(control) - mean(exposed) > 10);
  for (let i = 1; i < days.length; i++) {
    assert.equal(days[i].previousAlcohol, days[i - 1].alcohol);
    assert.equal(days[i - 1].date, addCalendarDays(days[i].date, -1));
  }
});

test("canonical ingestion validates the entire adapter response before any write", async () => {
  const valid = await new MockHealthDataSource(options).getSamples(request);
  let writes = 0;
  const writer = { async saveMetrics(samples: typeof valid) { writes++; return samples.length; } };
  const receipt = await ingestHealthData(new MockHealthDataSource(options), request, writer);
  assert.equal(receipt.stored, valid.length); assert.equal(writes, 1);
  for (const input of [
    [...valid, { ...valid[0], id: "bad", unit: "invented" }],
    [...valid, valid[0]],
    [...valid, { ...valid[0], id: "other-id" }],
  ]) {
    await assert.rejects(ingestHealthData({ async getSamples() { return input as typeof valid; } }, request, writer));
  }
  assert.equal(writes, 1);
  await assert.rejects(ingestHealthData(new MockHealthDataSource(options), request, { async saveMetrics() { throw new Error("Offline"); } }));
  await assert.rejects(ingestHealthData(new MockHealthDataSource(options), request, { async saveMetrics() { return 0; } }));
});
