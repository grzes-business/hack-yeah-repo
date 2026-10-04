import assert from "node:assert/strict";
import { test } from "node:test";
import { addCalendarDays, type DailyFeatures } from "../domain";
import { emptyHistory, setKnown } from "../analytics/test-helpers";
import { compareExperiment, pausedDates } from "./compare";
import { createExperimentPlan, ExperimentActionSchema, ExperimentPlanSchema, ExperimentTransitions, type ExperimentEvent } from "./contracts";

const TODAY = "2026-10-03";
const acceptedAt = "2026-09-20T07:00:00.000Z";
const demoPlan = () => createExperimentPlan({ id: "exp-1", scope: "demo", today: TODAY, acceptedAt });
const accepted: ExperimentEvent = { type: "accepted", at: acceptedAt, date: "2026-09-20" };

/** Baseline: 7h sleep, energy 5. Intervention: 8h sleep + energy 7, except the listed days. */
function history(opts: { shortNights?: string[]; unknownSleep?: string[]; energyDays?: number; baselineEnergy?: number } = {}) {
  const plan = demoPlan();
  const rows = emptyHistory();
  const byDate = new Map(rows.map(r => [r.date, r]));
  for (let d = plan.baseline.from; d <= plan.baseline.to; d = addCalendarDays(d, 1)) {
    setKnown(byDate.get(d)!, "sleep_duration", 420); setKnown(byDate.get(d)!, "energy", opts.baselineEnergy ?? 5); setKnown(byDate.get(d)!, "hrv", 50);
  }
  let energySet = 0;
  for (let d = plan.intervention.from; d <= plan.intervention.to; d = addCalendarDays(d, 1)) {
    const row = byDate.get(d)!;
    if (!opts.unknownSleep?.includes(d)) setKnown(row, "sleep_duration", opts.shortNights?.includes(d) ? 400 : 480);
    if (energySet < (opts.energyDays ?? 14)) { setKnown(row, "energy", 7); setKnown(row, "hrv", 56); energySet++; }
  }
  return { plan, rows: rows as DailyFeatures[] };
}

test("plans are predeclared from a registered template; personal plans start today and cannot be retrospective", () => {
  const personal = createExperimentPlan({ id: "p", scope: "personal", today: TODAY, acceptedAt });
  assert.deepEqual([personal.intervention.from, personal.intervention.to, personal.baseline.from], [TODAY, "2026-10-16", "2026-09-19"]);
  assert.equal(personal.retrospectiveDemo, false);
  assert.equal(demoPlan().retrospectiveDemo, true);
  assert.equal(demoPlan().intervention.to, TODAY);
  assert.equal(ExperimentPlanSchema.safeParse({ ...personal, retrospectiveDemo: true }).success, false);
  assert.equal(ExperimentPlanSchema.safeParse({ ...personal, relationshipId: "workout_rpe__energy" }).success, false);
  assert.equal(ExperimentActionSchema.safeParse({ action: "accept", templateId: "rpe_primary", scope: "demo" }).success, false);
  assert.deepEqual(ExperimentTransitions.resume.from, ["paused"]);
});

test("completed plan reproduces declared counts, medians and differences; unknown sleep never counts as adherent", () => {
  const plan = demoPlan();
  const { rows } = history({ shortNights: [addCalendarDays(plan.intervention.from, 2), addCalendarDays(plan.intervention.from, 3)], unknownSleep: [addCalendarDays(plan.intervention.from, 5), addCalendarDays(plan.intervention.from, 6)] });
  const result = compareExperiment(plan, "active", [accepted], rows, TODAY);
  assert.equal(result.state, "descriptive");
  assert.deepEqual([result.intervention.eligibleDays, result.intervention.sleepKnown, result.intervention.adherentNights, result.intervention.missingSleep], [14, 12, 10, 2]);
  assert.deepEqual([result.baseline.energyDays, result.baseline.energyMedian, result.intervention.energyMedian], [14, 5, 7]);
  assert.equal(result.energyDifference, 2);
  assert.equal(result.energyRelativeDifference, 0.4);
  assert.equal(result.hrvDifference, 6);
  assert.equal(result.adherenceRate, 10 / 12);
  assert.match(result.limitations[0], /Synthetic demonstration/);
});

test("too few adherent days with energy is inconclusive with no difference reported", () => {
  const { plan, rows } = history({ energyDays: 3 });
  const result = compareExperiment(plan, "active", [accepted], rows, TODAY);
  assert.equal(result.state, "inconclusive");
  assert.equal(result.energyDifference, null);
  assert.ok(result.limitations.some(l => /at least 5 days/.test(l)));
});

test("a plan still running is in progress and excludes future days", () => {
  const plan = createExperimentPlan({ id: "p", scope: "personal", today: "2026-09-26", acceptedAt });
  const result = compareExperiment(plan, "active", [accepted], history().rows, "2026-09-30");
  assert.equal(result.state, "in_progress");
  assert.equal(result.intervention.eligibleDays, 5);
});

test("paused days are excluded until resumed, and still-paused days through today", () => {
  const events: ExperimentEvent[] = [accepted, { type: "paused", at: acceptedAt, date: "2026-09-22" }, { type: "resumed", at: acceptedAt, date: "2026-09-25" }];
  assert.deepEqual([...pausedDates(events, TODAY)], ["2026-09-22", "2026-09-23", "2026-09-24"]);
  const result = compareExperiment(demoPlan(), "active", events, history().rows, TODAY);
  assert.equal(result.intervention.pausedDays, 3);
  assert.equal(result.intervention.eligibleDays, 11);
  assert.deepEqual([...pausedDates([accepted, { type: "paused", at: acceptedAt, date: "2026-10-02" }], TODAY)], ["2026-10-02", "2026-10-03"]);
});

test("a zero baseline median has no relative difference", () => {
  const { plan, rows } = history({ baselineEnergy: 0 });
  const result = compareExperiment(plan, "completed", [accepted], rows, TODAY);
  assert.equal(result.energyDifference, 7);
  assert.equal(result.energyRelativeDifference, null);
});
