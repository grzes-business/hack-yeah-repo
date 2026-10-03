import { z } from "zod";

export const DOMAIN_CONTRACT_VERSION = 1 as const;

// Opaque IDs allow source fixtures and persistence to use the same contracts.
export const RecordIdSchema = z.string().min(1).max(200).refine(
  (value) => value.trim() === value && value.length > 0,
  "IDs must be nonblank and have no surrounding whitespace",
);
export const TimestampSchema = z.iso.datetime().refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Expected a valid UTC instant",
);
export const LocalDateSchema = z.iso.date();
export const TimeZoneSchema = z.string().refine((value) => {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}, "Expected an IANA time zone, such as Europe/Warsaw or UTC");

export const AnalysisPeriodSchema = z.strictObject({
  from: LocalDateSchema,
  to: LocalDateSchema,
}).refine((period) => period.from <= period.to, {
  message: "Period end must not precede its start",
  path: ["to"],
});

export const ProvenanceSchema = z.strictObject({
  metricSampleIds: z.array(RecordIdSchema),
  subjectiveEventIds: z.array(RecordIdSchema),
}).refine((refs) => refs.metricSampleIds.length + refs.subjectiveEventIds.length > 0,
  "Known features require at least one source observation");

export type LocalDate = z.infer<typeof LocalDateSchema>;
export type TimeZone = z.infer<typeof TimeZoneSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** Calendar keys use the user's zone, never the execution host's zone. */
export function getLocalDate(instant: string, timeZone: string): LocalDate {
  TimestampSchema.parse(instant);
  TimeZoneSchema.parse(timeZone);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === name)!.value;
  return LocalDateSchema.parse(`${part("year")}-${part("month")}-${part("day")}`);
}

/** Shift a calendar key, not an instant: DST days are not always 24 hours. */
export function addCalendarDays(date: LocalDate, days: number): LocalDate {
  LocalDateSchema.parse(date);
  z.number().int().parse(days);
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return LocalDateSchema.parse(instant.toISOString().slice(0, 10));
}
