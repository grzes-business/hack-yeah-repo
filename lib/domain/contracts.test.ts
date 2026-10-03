import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AgentModeSchema, AlcoholValueSchema, CaffeineValueSchema, DailyFeaturesSchema,
  EvidenceBundleSchema, ExtractionDraftResultSchema, ExtractionResultSchema, FeatureSchema, Features,
  MetricSampleSchema, Metrics, PainValueSchema, RelationshipRegistry, RelationshipResultSchema,
  RelationshipSchema, SubjectiveEventSchema, TimeZoneSchema, TimestampSchema,
  addCalendarDays, getFactorDate, getLocalDate,
  type DailyFeatureStates, type MetricSample,
} from "./index";

const instant = "2026-10-03T08:00:00.000Z";
const metricRefs = { metricSampleIds: ["hrv-1"], subjectiveEventIds: [] };
const eventRefs = { metricSampleIds: [], subjectiveEventIds: ["energy-1"] };
const sample = {
  id: "hrv-1", metric: "hrv", value: 40, unit: "ms",
  startedAt: instant, endedAt: instant,
  source: { type: "mock", externalId: "external-hrv-1" },
};
const event = {
  id: "energy-1", type: "energy", value: 3,
  occurredAt: instant, capturedAt: instant, timeZone: "Europe/Warsaw",
  conversationTurnId: "turn-1", extractionConfidence: null,
};

function daily(overrides: Partial<DailyFeatureStates> = {}) {
  return DailyFeaturesSchema.parse({
    contractVersion: 1, userId: "demo-user", date: "2026-10-03", timeZone: "Europe/Warsaw",
    builtAt: instant, builderVersion: "fixture-v1",
    features: {
      ...Object.fromEntries(Object.values(Features).map((key) => [key, { status: "unknown", reason: "not_observed" }])),
      hrv: { status: "known", value: 40, provenance: metricRefs },
      energy: { status: "known", value: 3, provenance: eventRefs },
      ...overrides,
    },
  });
}

function relationshipResult(overrides: Record<string, unknown> = {}) {
  return {
    relationshipId: "sleep_duration__energy", userId: "demo-user",
    period: { from: "2026-10-01", to: "2026-10-02" },
    pairedOutcomeDates: ["2026-10-01", "2026-10-02"], sampleSize: 2,
    computedAt: instant, analysisVersion: "fixture-v1", status: "evaluated",
    evidence: "WEAK_SIGNAL", effect: { kind: "spearman", rho: 0.5 }, limitations: [],
    ...overrides,
  };
}

function bundle(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1, outcome: "energy", dailyFeatures: daily(),
    generatedAt: instant, analysisVersion: "fixture-v1", currentAnomalies: [], contextDays: [],
    relationships: [relationshipResult()], missingPotentialFactors: [{ feature: "illness", date: "2026-10-03" }], limitations: [],
    ...overrides,
  };
}

test("registry keys, units, values, and unknown fields are validated together", () => {
  assert.equal(MetricSampleSchema.parse(sample).value, 40);
  for (const override of [
    { metric: "invented_score" }, { unit: "bpm" }, { value: "40" },
    { value: NaN }, { value: Infinity }, { value: -1 }, { secretScore: 9 },
    { source: { type: "invented", externalId: "x" } },
  ]) assert.equal(MetricSampleSchema.safeParse({ ...sample, ...override }).success, false);
  assert.equal(MetricSampleSchema.safeParse({ ...sample, metric: "steps", unit: "count", value: 1.5 }).success, false);
});

test("inferred sample types retain metric-specific value and unit narrowing", () => {
  const parsed: MetricSample = MetricSampleSchema.parse(sample);
  function check(value: MetricSample) {
    if (value.metric === Metrics.HRV) {
      const numeric: number = value.value;
      const unit: "ms" = value.unit;
      assert.equal(numeric, 40);
      assert.equal(unit, "ms");
    } else if (value.metric === Metrics.SLEEP_START) {
      const timestamp: string = value.value;
      const unit: "iso8601" = value.unit;
      assert.equal(typeof timestamp, "string");
      assert.equal(unit, "iso8601");
    }
  }
  check(parsed);
});

test("UTC instants and interval ordering are explicit", () => {
  assert.equal(TimestampSchema.safeParse("2026-10-03T10:00:00+02:00").success, false);
  assert.equal(TimestampSchema.safeParse("2026-10-03T10:00:00").success, false);
  assert.equal(MetricSampleSchema.safeParse({ ...sample, endedAt: "2026-10-02T08:00:00Z" }).success, false);
  const sleep = { ...sample, metric: "sleep_start", unit: "iso8601", value: "2026-10-02T22:00:00Z", startedAt: "2026-10-02T22:00:00Z", endedAt: instant };
  assert.equal(MetricSampleSchema.safeParse(sleep).success, true);
  assert.equal(MetricSampleSchema.safeParse({ ...sleep, value: instant }).success, false);
});

test("user-local dates and calendar lags handle midnight, DST, and year boundaries", () => {
  assert.equal(getLocalDate("2026-10-02T23:30:00Z", "Europe/Warsaw"), "2026-10-03");
  assert.equal(getLocalDate("2026-10-03T01:30:00Z", "America/Los_Angeles"), "2026-10-02");
  assert.equal(getFactorDate("sleep_duration__energy", "2026-10-03"), "2026-10-03");
  assert.equal(getFactorDate("stress__sleep_duration", "2026-10-03"), "2026-10-02");
  assert.equal(getFactorDate("alcohol__hrv", "2026-01-01"), "2025-12-31");
  assert.equal(getFactorDate("alcohol__hrv", "2026-03-30"), "2026-03-29");
  assert.equal(addCalendarDays("2024-03-01", -1), "2024-02-29");
  assert.throws(() => addCalendarDays("2026-02-29", 1));
  assert.equal(TimeZoneSchema.safeParse("Mars/Olympus").success, false);
  assert.equal(TimeZoneSchema.safeParse("+02:00").success, false);
});

test("event ratings allow anchored zero but reject guesses, unknown types, and missing provenance", () => {
  assert.equal(SubjectiveEventSchema.safeParse({ ...event, value: 0 }).success, true);
  for (const override of [{ value: -1 }, { value: 11 }, { value: "3" }, { type: "brain_scrambledness" }, { conversationTurnId: "" }, { occurredAt: "2026-10-04T08:00:00Z" }]) {
    assert.equal(SubjectiveEventSchema.safeParse({ ...event, ...override }).success, false);
  }
  assert.equal(SubjectiveEventSchema.safeParse({ ...event, type: "illness", value: "false" }).success, false);
});

test("reported presence, unknown quantities, and explicit absence are distinct", () => {
  assert.equal(AlcoholValueSchema.safeParse({ consumed: true, quantity: null, unit: "reported_drinks" }).success, true);
  assert.equal(AlcoholValueSchema.safeParse({ consumed: false, quantity: 0, unit: "reported_drinks" }).success, true);
  assert.equal(AlcoholValueSchema.safeParse({ consumed: false, quantity: 2, unit: "reported_drinks" }).success, false);
  assert.equal(AlcoholValueSchema.safeParse({ consumed: true, quantity: 2, unit: "standard_drinks" }).success, false);
  assert.equal(CaffeineValueSchema.safeParse({ consumed: true, amountMg: null }).success, true);
  assert.equal(CaffeineValueSchema.safeParse({ consumed: false, amountMg: null }).success, false);
  assert.equal(PainValueSchema.safeParse({ present: true, location: "knee", intensity: null }).success, true);
  assert.equal(PainValueSchema.safeParse({ present: false, location: "knee", intensity: 0 }).success, false);
});

test("extraction outcomes cannot claim an empty capture or carry ambiguous accepted events", () => {
  assert.equal(ExtractionResultSchema.safeParse({ status: "captured", events: [event] }).success, true);
  assert.equal(ExtractionResultSchema.safeParse({ status: "captured", events: [] }).success, false);
  assert.equal(ExtractionResultSchema.safeParse({ status: "needs_clarification", eventType: "energy", reason: "Missing rating", events: [event] }).success, false);
});

test("model extraction candidates cannot assign application-owned provenance", () => {
  const draft = { type: "energy", value: 3, occurredAt: instant, extractionConfidence: null };
  assert.equal(ExtractionDraftResultSchema.safeParse({ status: "captured", events: [draft] }).success, true);
  assert.equal(ExtractionDraftResultSchema.safeParse({ status: "captured", events: [event] }).success, false);
  assert.equal(SubjectiveEventSchema.safeParse(draft).success, false);
});

test("daily features preserve missingness and validate observation origin", () => {
  assert.equal(daily().features.alcohol.status, "unknown");
  assert.equal(daily({ alcohol: { status: "known", value: false, provenance: eventRefs } }).features.alcohol.status, "known");
  assert.equal(DailyFeaturesSchema.safeParse({ ...daily(), features: { ...daily().features, alcohol: null } }).success, false);
  assert.equal(DailyFeaturesSchema.safeParse({ ...daily(), features: { ...daily().features, alcohol: { status: "unknown", reason: "not_observed", value: false } } }).success, false);
  assert.throws(() => daily({ hrv: { status: "known", value: 40, provenance: eventRefs } }));
  assert.equal(FeatureSchema.safeParse("training_load").success, false);
});

test("registered graph definitions cannot introduce a factor, outcome, or lag", () => {
  const registered = RelationshipRegistry.sleep_duration__energy;
  assert.equal(RelationshipSchema.safeParse(registered).success, true);
  for (const override of [{ id: "invented" }, { factor: "mood" }, { lagDays: 1 }, { outcome: "hrv" }, { confounders: [] }]) {
    assert.equal(RelationshipSchema.safeParse({ ...registered, ...override }).success, false);
  }
  assert.equal(AgentModeSchema.safeParse("capture").success, true);
  assert.equal(AgentModeSchema.safeParse("omniscient_coach").success, false);
});

test("evidence rejects mismatched methods, inflated counts, and impossible correlations", () => {
  assert.equal(RelationshipResultSchema.safeParse(relationshipResult()).success, true);
  for (const override of [{ sampleSize: 40 }, { effect: { kind: "spearman", rho: 1.2 } }, { pairedOutcomeDates: ["2026-10-01", "2026-10-01"] }, { relationshipId: "alcohol__hrv" }]) {
    assert.equal(RelationshipResultSchema.safeParse(relationshipResult(override)).success, false);
  }
  assert.equal(RelationshipResultSchema.safeParse(relationshipResult({ status: "insufficient_data", evidence: "INSUFFICIENT_DATA", effect: null, sampleSize: 0, pairedOutcomeDates: [], limitations: ["No eligible pairs"] })).success, true);
  assert.equal(RelationshipResultSchema.safeParse(relationshipResult({ evidence: "INSUFFICIENT_DATA" })).success, false);
});

test("exposure counts and effects keep their actual outcome units and denominator", () => {
  const effect = { kind: "exposure", exposedCount: 1, controlCount: 1, exposedMedian: 40, controlMedian: 50, medianDifference: -10, relativeDifference: -0.2, unit: "ms" };
  const result = relationshipResult({ relationshipId: "alcohol__hrv", effect });
  assert.equal(RelationshipResultSchema.safeParse(result).success, true);
  for (const override of [{ unit: "rating" }, { exposedCount: 20 }, { relativeDifference: -20 }, { medianDifference: 10 }]) {
    assert.equal(RelationshipResultSchema.safeParse({ ...result, effect: { ...effect, ...override } }).success, false);
  }
});

test("bundle enforces the investigated user, outcome, known state, and allowed context", () => {
  assert.equal(EvidenceBundleSchema.safeParse(bundle()).success, true);
  for (const override of [
    { relationships: [relationshipResult({ userId: "another-user" })] },
    { relationships: [relationshipResult({ relationshipId: "stress__sleep_duration" })] },
    { missingPotentialFactors: [{ feature: "energy", date: "2026-10-03" }] },
    { missingPotentialFactors: [{ feature: "steps", date: "2026-10-03" }] },
    { missingPotentialFactors: [{ feature: "illness", date: "2026-10-03" }, { feature: "illness", date: "2026-10-03" }] },
  ]) assert.equal(EvidenceBundleSchema.safeParse(bundle(override)).success, false);
});

test("missing context uses the factor's date rather than today's known or unknown state", () => {
  const today = daily({ alcohol: { status: "known", value: false, provenance: eventRefs } });
  const yesterday = { ...daily(), date: "2026-10-02" };
  const investigation = bundle({ outcome: "hrv", dailyFeatures: today, contextDays: [yesterday], relationships: [], missingPotentialFactors: [{ feature: "alcohol", date: "2026-10-02" }] });
  assert.equal(EvidenceBundleSchema.safeParse(investigation).success, true);
  assert.equal(EvidenceBundleSchema.safeParse({ ...investigation, missingPotentialFactors: [{ feature: "alcohol", date: "2026-10-03" }] }).success, false);
  assert.equal(EvidenceBundleSchema.safeParse({ ...investigation, contextDays: [] }).success, false);
  assert.equal(EvidenceBundleSchema.safeParse({ ...investigation, contextDays: [{ ...yesterday, features: { ...yesterday.features, alcohol: { status: "known", value: true, provenance: eventRefs } } }] }).success, false);
});

test("anomalies must match the current observation and its provenance", () => {
  const anomaly = { metric: "hrv", value: 40, baseline: 50, unit: "ms", baselinePeriod: { from: "2026-09-01", to: "2026-10-02" }, baselineSampleSize: 20, relativeDifference: -0.2, classification: "unusually_low", provenance: metricRefs };
  assert.equal(EvidenceBundleSchema.safeParse(bundle({ currentAnomalies: [anomaly] })).success, true);
  for (const override of [{ value: 39 }, { classification: "unusually_high" }, { relativeDifference: -20 }, { provenance: { metricSampleIds: ["unrelated"], subjectiveEventIds: [] } }]) {
    assert.equal(EvidenceBundleSchema.safeParse(bundle({ currentAnomalies: [{ ...anomaly, ...override }] })).success, false);
  }
});
