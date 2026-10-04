import { addCalendarDays, type DailyFeatures, type LocalDate } from "../domain";
import { median } from "../analytics/engine";
import type { ExperimentEvent, ExperimentPlan, ExperimentStatus } from "./contracts";

/**
 * Deterministic descriptive comparison for a predeclared plan. No imputation:
 * unknown sleep or energy days are excluded and counted, never treated as zero,
 * and a day without known sleep never counts as adherent.
 */
export interface GroupSummary {
  days: number;
  energyDays: number; energyMedian: number | null; missingEnergy: number;
  hrvDays: number; hrvMedian: number | null;
  illnessDays: number; alcoholPreviousDays: number; stressMedian: number | null;
}
export interface ExperimentResult {
  state: "in_progress" | "inconclusive" | "descriptive";
  evaluatedThrough: LocalDate;
  baseline: GroupSummary & { nightsMeetingTarget: number };
  intervention: GroupSummary & { eligibleDays: number; pausedDays: number; sleepKnown: number; adherentNights: number; missingSleep: number };
  adherenceRate: number | null;
  energyDifference: number | null;
  energyRelativeDifference: number | null;
  hrvDifference: number | null;
  limitations: string[];
}

const known = (row: DailyFeatures | undefined, key: keyof DailyFeatures["features"]) => {
  const state = row?.features[key];
  return state?.status === "known" ? state.value : undefined;
};

function datesBetween(from: LocalDate, to: LocalDate) {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addCalendarDays(d, 1)) out.push(d);
  return out;
}

/** Local dates between a pause and the following resume (or still paused) are excluded. */
export function pausedDates(events: ExperimentEvent[], through: LocalDate) {
  const paused = new Set<LocalDate>();
  let since: LocalDate | null = null;
  for (const e of events) {
    if (e.type === "paused") since = e.date;
    if (e.type === "resumed" && since) { for (const d of datesBetween(since, addCalendarDays(e.date, -1))) paused.add(d); since = null; }
  }
  if (since) for (const d of datesBetween(since, through)) paused.add(d);
  return paused;
}

function summarize(rows: Map<LocalDate, DailyFeatures>, dates: LocalDate[]): GroupSummary {
  const energy: number[] = [], hrv: number[] = [], stress: number[] = [];
  let illnessDays = 0, alcoholPreviousDays = 0;
  for (const date of dates) {
    const row = rows.get(date);
    const e = known(row, "energy"), h = known(row, "hrv"), s = known(row, "stress");
    if (typeof e === "number") energy.push(e);
    if (typeof h === "number") hrv.push(h);
    if (typeof s === "number") stress.push(s);
    if (known(row, "illness") === true) illnessDays++;
    if (known(rows.get(addCalendarDays(date, -1)), "alcohol") === true) alcoholPreviousDays++;
  }
  return {
    days: dates.length, energyDays: energy.length, energyMedian: median(energy), missingEnergy: dates.length - energy.length,
    hrvDays: hrv.length, hrvMedian: median(hrv), illnessDays, alcoholPreviousDays, stressMedian: median(stress),
  };
}

export function compareExperiment(plan: ExperimentPlan, status: ExperimentStatus, events: ExperimentEvent[], rows: readonly DailyFeatures[], today: LocalDate): ExperimentResult {
  const byDate = new Map(rows.map(r => [r.date, r]));
  const stoppedOn = events.find(e => e.type === "completed" || e.type === "abandoned")?.date;
  const through = [plan.intervention.to, today, ...(stoppedOn ? [stoppedOn] : [])].sort()[0];
  const paused = pausedDates(events, through);

  const baselineDates = datesBetween(plan.baseline.from, plan.baseline.to);
  const nightsMeetingTarget = baselineDates.filter(d => { const v = known(byDate.get(d), "sleep_duration"); return typeof v === "number" && v >= plan.targetSleepMinutes; }).length;

  const window = through >= plan.intervention.from ? datesBetween(plan.intervention.from, through) : [];
  const eligible = window.filter(d => !paused.has(d));
  const sleepKnown = eligible.filter(d => typeof known(byDate.get(d), "sleep_duration") === "number");
  const adherent = sleepKnown.filter(d => (known(byDate.get(d), "sleep_duration") as number) >= plan.targetSleepMinutes);

  const baseline = { ...summarize(byDate, baselineDates), nightsMeetingTarget };
  const intervention = {
    ...summarize(byDate, adherent),
    eligibleDays: eligible.length, pausedDays: window.length - eligible.length,
    sleepKnown: sleepKnown.length, adherentNights: adherent.length, missingSleep: eligible.length - sleepKnown.length,
  };

  const enough = baseline.energyDays >= plan.minimumDaysPerGroup && intervention.energyDays >= plan.minimumDaysPerGroup;
  const finished = status === "completed" || status === "abandoned" || through >= plan.intervention.to;
  const energyDifference = enough && baseline.energyMedian !== null && intervention.energyMedian !== null ? intervention.energyMedian - baseline.energyMedian : null;
  const hrvEnough = baseline.hrvDays >= plan.minimumDaysPerGroup && intervention.hrvDays >= plan.minimumDaysPerGroup;

  const limitations = [
    "Descriptive before/after comparison, not a randomized trial: it cannot show that sleep caused any change.",
    "Intervention days count only when recorded sleep met the target that night; unknown sleep or energy is excluded, never imputed.",
  ];
  if (plan.retrospectiveDemo) limitations.unshift("Synthetic demonstration over fictional sample history, evaluated retrospectively.");
  if (intervention.pausedDays) limitations.push(`${intervention.pausedDays} paused day(s) are excluded.`);
  if (baseline.nightsMeetingTarget) limitations.push(`${baseline.nightsMeetingTarget} baseline night(s) already met the target, which narrows the contrast.`);
  if (baseline.illnessDays !== intervention.illnessDays || baseline.alcoholPreviousDays !== intervention.alcoholPreviousDays) {
    limitations.push("Reported illness or previous-day alcohol differs between periods and may explain part of any difference.");
  }
  if (!enough) limitations.push(`Each period needs at least ${plan.minimumDaysPerGroup} days with a known energy rating.`);

  return {
    state: !finished ? "in_progress" : enough ? "descriptive" : "inconclusive",
    evaluatedThrough: through, baseline, intervention,
    adherenceRate: sleepKnown.length ? adherent.length / sleepKnown.length : null,
    energyDifference,
    energyRelativeDifference: energyDifference !== null && baseline.energyMedian ? energyDifference / baseline.energyMedian : null,
    hrvDifference: hrvEnough && baseline.hrvMedian !== null && intervention.hrvMedian !== null ? intervention.hrvMedian - baseline.hrvMedian : null,
    limitations,
  };
}
