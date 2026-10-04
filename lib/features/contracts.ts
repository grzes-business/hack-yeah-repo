import { z } from "zod";
import { addCalendarDays, AnalysisPeriodSchema } from "../domain";
export const FEATURE_BUILDER_VERSION = "daily-v1";
export const FeatureScopeSchema = z.enum(["personal", "demo"]);
export type FeatureScope = z.infer<typeof FeatureScopeSchema>;
export const FeatureRangeSchema = AnalysisPeriodSchema.safeExtend({ scope: FeatureScopeSchema.default("personal") })
 .refine(v => Date.parse(v.to) - Date.parse(v.from) <= 59 * 86400000, "Rebuild at most 60 days at once");
export function builderVersion(scope: FeatureScope) { return `${FEATURE_BUILDER_VERSION}:${scope}`; }
export function featureDates(from: string, to: string) {
 const range = FeatureRangeSchema.parse({ from, to });
 const dates: string[] = [];
 for (let date = range.from; date <= range.to; date = addCalendarDays(date, 1)) dates.push(date);
 return dates;
}
export function inputEnvelope(from: string, to: string) {
 // Cover every IANA offset. Range readers return whole overlapping intervals.
 return { from: new Date(`${addCalendarDays(from, -2)}T00:00:00Z`), to: new Date(`${addCalendarDays(to, 2)}T00:00:00Z`) };
}
