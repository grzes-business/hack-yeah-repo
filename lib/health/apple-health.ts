import { MetricRegistry, MetricSampleSchema, type Metric, type MetricSample } from "../domain";
import { HealthDataSourceRequestSchema, parseHealthDataSourceResponse, type HealthDataSource, type HealthDataSourceRequest } from "./data-source";

/**
 * Stage 12 Apple Health adapter. Native access goes through `AppleHealthClient`,
 * a structural subset of `@capgo/capacitor-health`, so this module stays free of
 * Capacitor imports and is unit-testable with recorded payloads. HealthKit
 * objects never leave this file: everything is normalized to `MetricSample[]`
 * and validated by the shared source contract.
 */

export type AppleDataType = "heartRateVariability" | "restingHeartRate" | "sleep" | "steps" | "calories" | "workouts";

export interface AppleSample {
  value: number; unit: string; startDate: string; endDate: string;
  sourceName?: string; sourceId?: string; platformId?: string; sleepState?: string;
}
export interface AppleAggregate { startDate: string; endDate: string; value: number; unit: string }
export interface AppleWorkout {
  duration: number; startDate: string; endDate: string; workoutType: string;
  sourceName?: string; sourceId?: string; platformId?: string;
}
export interface AppleHealthClient {
  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  requestAuthorization(options: { read: AppleDataType[] }): Promise<unknown>;
  readSamples(options: { dataType: AppleDataType; startDate: string; endDate: string; limit: number; ascending: boolean }): Promise<{ samples: AppleSample[] }>;
  queryAggregated(options: { dataType: "steps" | "calories"; startDate: string; endDate: string; bucket: "day"; aggregation: "sum" }): Promise<{ samples: AppleAggregate[] }>;
  queryWorkouts(options: { startDate: string; endDate: string; limit: number; ascending: boolean; anchor?: string }): Promise<{ workouts: AppleWorkout[]; anchor?: string }>;
}

/**
 * Per-metric outcome of the last read. iOS hides read authorization, so
 * `no_records` means "nothing readable": either no history or access declined.
 */
export type AppleMetricStatus =
  | { metric: Metric; status: "records"; count: number }
  | { metric: Metric; status: "no_records" }
  | { metric: Metric; status: "unsupported"; reason: string }
  | { metric: Metric; status: "failed"; reason: string };

/** Metrics the adapter can read. `workout_avg_hr` has no plugin source yet. */
export const APPLE_READ_TYPES: readonly AppleDataType[] = ["heartRateVariability", "restingHeartRate", "sleep", "steps", "calories", "workouts"];
const UNSUPPORTED: Partial<Record<Metric, string>> = {
  workout_avg_hr: "The Health plugin does not expose workout heart rate; the value stays unknown.",
};

const PROVIDER = "Apple Health";
const HOUR = 3600000, DAY = 24 * HOUR;
/** Sleep segments separated by less than this belong to one session. */
const SLEEP_SESSION_GAP_MS = 90 * 60000;
/** Sleep reads are widened so sessions crossing the range edge are complete. */
const SLEEP_READ_MARGIN_MS = 18 * HOUR;
const ASLEEP_STATES = new Set(["asleep", "light", "deep", "rem"]);
const IN_BED_STATES = new Set(["inBed"]);
const READ_LIMIT = 20000;
/** A HealthKit read that has not answered by then is reported as failed, not left spinning. */
export const APPLE_READ_TIMEOUT_MS = 45000;
const WORKOUT_PAGE = 200;

const iso = (ms: number) => new Date(ms).toISOString();
/** Stage 13: the same HealthKit object can arrive twice (re-imports, overlapping pages). */
function uniqueByPlatformId<T extends { platformId?: string }>(raw: T[]): T[] {
  const seen = new Set<string>();
  return raw.filter(r => !r.platformId || (seen.has(r.platformId) ? false : (seen.add(r.platformId), true)));
}
const overlaps = (start: number, end: number, from: number, to: number) =>
  start === end ? start >= from && start < to : start < to && end > from;

function sample(metric: Metric, id: string, externalId: string, value: number | string, startedAt: string, endedAt: string, device?: string, sessionId?: string): MetricSample {
  return MetricSampleSchema.parse({
    id, metric, value, unit: MetricRegistry[metric].unit, startedAt, endedAt,
    source: { type: "apple_health", externalId, provider: PROVIDER, ...(device ? { device: device.slice(0, 200) } : {}) },
    ...(sessionId ? { sessionId } : {}),
  });
}

/** Point/short quantity samples (HRV SDNN in ms, resting heart rate in bpm). */
export function normalizeQuantitySamples(metric: "hrv" | "resting_hr", raw: AppleSample[], expectedUnit: string): MetricSample[] {
  return uniqueByPlatformId(raw).filter(s => s.platformId).map(s => {
    if (s.unit !== expectedUnit) throw new Error(`Unexpected ${metric} unit: ${s.unit}`);
    return sample(metric, `apple_health:${metric}:${s.platformId}`, s.platformId!, s.value, iso(Date.parse(s.startDate)), iso(Date.parse(s.endDate)), s.sourceName);
  });
}

/**
 * Daily totals from HealthKit statistics (sources de-duplicated by HealthKit).
 * Buckets with no data are absent upstream, so no zero is invented; the current
 * day ends at `now` so a partial day is not presented as complete.
 */
export function normalizeDailyTotals(metric: "steps" | "active_energy", raw: AppleAggregate[], now: number): MetricSample[] {
  return raw.filter(b => Date.parse(b.startDate) < now).map(b => {
    const start = Date.parse(b.startDate), end = Math.min(Date.parse(b.endDate), now);
    const value = metric === "steps" ? Math.round(b.value) : Math.round(b.value * 10) / 10;
    const key = `apple_health:${metric}:${iso(start)}`;
    return sample(metric, key, key, value, iso(start), iso(end));
  });
}

interface SleepSession { key: string; source: string; device?: string; start: number; end: number; minutes: number }

/** Union length in minutes, so overlapping stage segments are not double counted. */
function unionMinutes(intervals: [number, number][]) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0, [curStart, curEnd] = sorted[0];
  for (const [s, e] of sorted.slice(1)) {
    if (s > curEnd) { total += curEnd - curStart; curStart = s; curEnd = e; } else curEnd = Math.max(curEnd, e);
  }
  return (total + curEnd - curStart) / 60000;
}

/**
 * Groups asleep segments (asleep/core/deep/REM; never in-bed or awake) per
 * recording source into sessions. When sessions from different sources overlap
 * (e.g. iPhone and Apple Watch), the one with more recorded sleep is kept rather
 * than summing both.
 */
export function buildSleepSessions(raw: AppleSample[]): SleepSession[] {
  const asleep = groupSleep(raw, ASLEEP_STATES);
  // iPhone without a Watch records only "In Bed". Such nights would otherwise be invisible, so in-bed
  // sessions count when no source recorded asleep stages overlapping them (Stage 13 source policy).
  const inBed = groupSleep(raw, IN_BED_STATES).filter(b => !asleep.some(a => a.start < b.end && b.start < a.end));
  return dedupeOverlapping([...asleep, ...inBed]);
}

function groupSleep(raw: AppleSample[], states: Set<string>): SleepSession[] {
  const bySource = new Map<string, AppleSample[]>();
  for (const s of uniqueByPlatformId(raw)) {
    if (!s.sleepState || !states.has(s.sleepState) || !s.platformId) continue;
    const source = s.sourceId ?? s.sourceName ?? "unknown";
    bySource.set(source, [...(bySource.get(source) ?? []), s]);
  }
  const sessions: SleepSession[] = [];
  for (const [source, segments] of bySource) {
    const sorted = [...segments].sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
    let group: AppleSample[] = [];
    const flush = () => {
      if (!group.length) return;
      const intervals = group.map(s => [Date.parse(s.startDate), Date.parse(s.endDate)] as [number, number]);
      sessions.push({
        key: `apple_health:sleep:${group[0].platformId}`, source, device: group[0].sourceName,
        start: Math.min(...intervals.map(i => i[0])), end: Math.max(...intervals.map(i => i[1])), minutes: unionMinutes(intervals),
      });
      group = [];
    };
    for (const s of sorted) {
      const lastEnd = group.length ? Math.max(...group.map(g => Date.parse(g.endDate))) : null;
      if (lastEnd !== null && Date.parse(s.startDate) - lastEnd > SLEEP_SESSION_GAP_MS) flush();
      group.push(s);
    }
    flush();
  }
  return sessions;
}

function dedupeOverlapping(sessions: SleepSession[]): SleepSession[] {
  const kept: SleepSession[] = [];
  for (const session of [...sessions].sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key))) {
    if (!kept.some(k => k.source !== session.source && k.start < session.end && session.start < k.end)) kept.push(session);
  }
  return kept.sort((a, b) => a.start - b.start);
}

export function normalizeSleep(raw: AppleSample[], metrics: Metric[], from: number, to: number): MetricSample[] {
  const out: MetricSample[] = [];
  for (const s of buildSleepSessions(raw)) {
    if (!overlaps(s.start, s.end, from, to)) continue;
    const start = iso(s.start), end = iso(s.end), external = s.key.slice("apple_health:sleep:".length);
    if (metrics.includes("sleep_duration")) out.push(sample("sleep_duration", `${s.key}:duration`, external, Math.round(s.minutes), start, end, s.device, s.key));
    if (metrics.includes("sleep_start")) out.push(sample("sleep_start", `${s.key}:start`, external, start, start, end, s.device, s.key));
    if (metrics.includes("sleep_end")) out.push(sample("sleep_end", `${s.key}:end`, external, end, start, end, s.device, s.key));
  }
  return out;
}

/**
 * Stage 13 source policy: one session recorded by two apps (e.g. Watch and a
 * running app) overlaps in time. Keep the longest recording per overlap so daily
 * totals are not double counted; same-source back-to-back workouts are kept.
 */
export function dedupeWorkoutSources(raw: AppleWorkout[]): AppleWorkout[] {
  const kept: AppleWorkout[] = [];
  const bySize = uniqueByPlatformId(raw).filter(w => w.platformId && w.duration >= 0)
    .sort((a, b) => b.duration - a.duration || String(a.platformId).localeCompare(String(b.platformId)));
  for (const w of bySize) {
    const start = Date.parse(w.startDate), end = Date.parse(w.endDate), source = w.sourceId ?? w.sourceName;
    const clash = kept.some(k => (k.sourceId ?? k.sourceName) !== source && Date.parse(k.startDate) < end && start < Date.parse(k.endDate));
    if (!clash) kept.push(w);
  }
  return kept.sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
}

export function normalizeWorkouts(raw: AppleWorkout[]): MetricSample[] {
  return dedupeWorkoutSources(raw).map(w => {
    const key = `apple_health:workout:${w.platformId}`;
    return sample("workout_duration", `${key}:duration`, w.platformId!, Math.round(w.duration / 6) / 10,
      iso(Date.parse(w.startDate)), iso(Date.parse(w.endDate)), w.sourceName, key);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} did not answer within ${Math.round(ms / 1000)} s`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class AppleHealthDataSource implements HealthDataSource {
  /** Status of the most recent `getSamples` call, for honest UI reporting. */
  lastReport: AppleMetricStatus[] = [];
  constructor(
    private readonly client: AppleHealthClient,
    private readonly now: () => number = Date.now,
    /** Called before each metric group is read, so the UI can show progress. */
    private readonly onProgress: (label: string) => void = () => {},
    private readonly timeoutMs = APPLE_READ_TIMEOUT_MS,
  ) {}

  async getSamples(request: HealthDataSourceRequest): Promise<MetricSample[]> {
    const args = HealthDataSourceRequestSchema.parse(request);
    const from = args.from.getTime(), to = args.to.getTime();
    const report: AppleMetricStatus[] = [], samples: MetricSample[] = [];
    const record = async (metrics: Metric[], read: () => Promise<MetricSample[]>) => {
      const wanted = metrics.filter(m => args.metrics.includes(m));
      if (!wanted.length) return;
      const label = MetricRegistry[wanted[0]].label.replace(/^Sleep duration$/, "Sleep");
      this.onProgress(label);
      try {
        const got = (await withTimeout(read(), this.timeoutMs, label)).filter(s => overlaps(Date.parse(s.startedAt), Date.parse(s.endedAt), from, to));
        samples.push(...got);
        for (const metric of wanted) {
          const count = got.filter(s => s.metric === metric).length;
          report.push(count ? { metric, status: "records", count } : { metric, status: "no_records" });
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Health query failed";
        for (const metric of wanted) report.push({ metric, status: "failed", reason });
      }
    };
    const range = { startDate: iso(from), endDate: iso(to), limit: READ_LIMIT, ascending: true };
    await record(["hrv"], async () => normalizeQuantitySamples("hrv", (await this.client.readSamples({ dataType: "heartRateVariability", ...range })).samples, "millisecond"));
    await record(["resting_hr"], async () => normalizeQuantitySamples("resting_hr", (await this.client.readSamples({ dataType: "restingHeartRate", ...range })).samples, "bpm"));
    await record(["sleep_duration", "sleep_start", "sleep_end"], async () => normalizeSleep((await this.client.readSamples({
      dataType: "sleep", startDate: iso(from - SLEEP_READ_MARGIN_MS), endDate: iso(to + SLEEP_READ_MARGIN_MS), limit: READ_LIMIT, ascending: true,
    })).samples, args.metrics, from, to));
    // Widen by a day so the edge buckets HealthKit returns are full local days.
    const daily = { startDate: iso(from - DAY), endDate: iso(to + DAY), bucket: "day" as const, aggregation: "sum" as const };
    await record(["steps"], async () => normalizeDailyTotals("steps", (await this.client.queryAggregated({ dataType: "steps", ...daily })).samples, this.now()));
    await record(["active_energy"], async () => normalizeDailyTotals("active_energy", (await this.client.queryAggregated({ dataType: "calories", ...daily })).samples, this.now()));
    await record(["workout_duration"], async () => {
      const workouts: AppleWorkout[] = [];
      let anchor: string | undefined;
      do {
        const page = await this.client.queryWorkouts({ startDate: iso(from), endDate: iso(to), limit: WORKOUT_PAGE, ascending: true, ...(anchor ? { anchor } : {}) });
        workouts.push(...page.workouts);
        anchor = page.workouts.length === WORKOUT_PAGE ? page.anchor : undefined;
      } while (anchor);
      return normalizeWorkouts(workouts);
    });
    for (const metric of args.metrics) {
      const reason = UNSUPPORTED[metric];
      if (reason) report.push({ metric, status: "unsupported", reason });
    }
    this.lastReport = report;
    const unique = [...new Map(samples.map(s => [s.id, s])).values()];
    return parseHealthDataSourceResponse(args, unique);
  }
}
