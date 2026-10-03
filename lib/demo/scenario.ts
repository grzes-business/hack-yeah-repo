import { z } from "zod";
import { addCalendarDays, LocalDateSchema, TimeZoneSchema } from "../domain";

export const DEMO_VERSION = "v1";
export const DemoOptionsSchema = z.strictObject({
  endDate: LocalDateSchema,
  days: z.number().int().min(1).max(60).default(56),
  seed: z.number().int().min(0).max(4294967295).default(2026),
  timeZone: TimeZoneSchema,
});
export type DemoOptions = z.input<typeof DemoOptionsSchema>;
export type ResolvedDemoOptions = z.output<typeof DemoOptionsSchema>;
export const DEMO_PREFIX = `demo:${DEMO_VERSION}:`;
export function demoNamespace(options: ResolvedDemoOptions) {
  return `${DEMO_PREFIX}${options.seed}:${encodeURIComponent(options.timeZone)}:`;
}

// Independent keyed randomness makes overlapping windows reproduce the same day.
function random(seed: number, date: string, channel: string): number {
  let hash = seed ^ 2166136261;
  for (const char of `${date}:${channel}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}
const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export type ScenarioDay = ReturnType<typeof scenarioDay>;
export function scenarioDay(date: string, seed: number) {
  LocalDateSchema.parse(date);
  const ordinal = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const yesterday = addCalendarDays(date, -1);
  const stress = (d: string) => round(1 + random(seed, d, "stress") * 8);
  const alcohol = (d: string) => random(seed, d, "alcohol") < 0.28;
  const effort = (d: string) => random(seed, d, "workout") < 0.65
    ? round(3 + random(seed, d, "effort") * 6) : null;
  const illness = ordinal % 23 === 0 || ordinal % 23 === 1;
  const previousAlcohol = alcohol(yesterday);
  const sleepMinutes = Math.round(clamp(505 - 18 * stress(yesterday) - (previousAlcohol ? 25 : 0)
    + (random(seed, date, "sleep-noise") - 0.5) * 36, 300, 550));
  const workoutRpe = effort(date);
  return {
    date, ordinal, stress: stress(date), alcohol: alcohol(date), previousAlcohol,
    illness, sleepMinutes, workoutRpe,
    workoutMinutes: workoutRpe === null ? null : Math.round(25 + workoutRpe * 5),
    hrv: round(58 - (previousAlcohol ? 15 : 0) - (illness ? 8 : 0)
      + (random(seed, date, "hrv-noise") - 0.5) * 8),
    restingHr: round(55 + (previousAlcohol ? 5 : 0) + (illness ? 7 : 0)
      + (random(seed, date, "heart-noise") - 0.5) * 6),
    energy: round(clamp(2 + 0.018 * (sleepMinutes - 300) - 0.35 * (effort(yesterday) ?? 0)
      - (illness ? 1.5 : 0) + (random(seed, date, "energy-noise") - 0.5), 0, 10)),
    mood: round(4 + random(seed, date, "mood") * 5),
    soreness: round(clamp((workoutRpe ?? 0) * 0.5 + random(seed, date, "soreness") * 2, 0, 10)),
    steps: Math.round(4000 + random(seed, date, "steps") * 6500 + (workoutRpe ? 2500 : 0)),
    // These omissions are fixtures, never analytical imputations.
    omitHrv: ordinal % 13 === 0,
    omitSleep: ordinal % 17 === 0,
    omitEnergy: ordinal % 9 === 0,
    omitStress: ordinal % 10 === 0,
    omitAlcohol: ordinal % 15 === 0,
    unknownCaffeineDose: ordinal % 11 === 0,
  };
}
export function scenarioDays(options: ResolvedDemoOptions): ScenarioDay[] {
  return Array.from({ length: options.days }, (_, index) =>
    scenarioDay(addCalendarDays(options.endDate, index - options.days + 1), options.seed));
}

/** Resolve an unambiguous fixture wall clock in an IANA zone, including DST. */
export function localInstant(date: string, hour: number, minute: number, timeZone: string): string {
  LocalDateSchema.parse(date); TimeZoneSchema.parse(timeZone);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("Invalid local clock time.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const part = (key: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === key)!.value);
    const represented = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    if (represented === target) return new Date(candidate).toISOString();
    candidate += target - represented;
  }
  throw new Error("Fixture clock falls in a time-zone transition gap.");
}
export function demoRange(options: ResolvedDemoOptions) {
  return {
    from: new Date(localInstant(addCalendarDays(options.endDate, 1 - options.days), 0, 0, options.timeZone)),
    to: new Date(localInstant(addCalendarDays(options.endDate, 1), 0, 0, options.timeZone)),
  };
}
