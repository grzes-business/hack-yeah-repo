import { getLocalDate, SubjectiveEventRegistry, type LocalDate } from "../domain";

// Stage 5 policy, fixed in code. The model may phrase a selected question but never selects or reorders dimensions.
export const CHECKIN_DIMENSIONS = ["energy", "soreness", "mood", "illness"] as const;
export type CheckinDimension = (typeof CHECKIN_DIMENSIONS)[number];

// Local window [05:00, 12:00) in the user's time zone. Starting and resuming both require it.
export type CheckinWindow = { opensAt: string; closesAt: string; startMinute: number; endMinute: number };
export const CHECKIN_WINDOW: CheckinWindow = { opensAt: "05:00", closesAt: "12:00", startMinute: 5 * 60, endMinute: 12 * 60 };

export type CheckinProgress = {
 localDate: LocalDate;
 // Dimensions with at least one accepted observation on this local date. Illness counts an explicit "no" too.
 answered: readonly CheckinDimension[];
 // Dimensions the user explicitly skipped. A skipped dimension stays unknown; it is never recorded as zero or false.
 skipped: readonly CheckinDimension[];
 ended: boolean;
};

export type CheckinStep =
 | { kind: "ask"; dimension: CheckinDimension; localDate: LocalDate }
 | { kind: "complete"; localDate: LocalDate; reason: "all_answered" | "resolved_with_skips" | "ended" }
 | { kind: "closed"; localDate: LocalDate; reason: "outside_window" | "ended" };

// Local date and minute-of-day for an instant in a time zone; the minute decides the window.
export function localClock(instant: string, timeZone: string): { localDate: LocalDate; minute: number } {
 const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
 const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value ?? NaN);
 return { localDate: getLocalDate(instant, timeZone), minute: value("hour") * 60 + value("minute") };
}

export function isWindowOpen(minute: number, window: CheckinWindow = CHECKIN_WINDOW): boolean {
 return minute >= window.startMinute && minute < window.endMinute;
}

// Pure and deterministic: identical progress and clock produce the identical step.
export function getNextStep(progress: CheckinProgress, minute: number, window: CheckinWindow = CHECKIN_WINDOW): CheckinStep {
 if (progress.ended) return { kind: "closed", localDate: progress.localDate, reason: "ended" };
 if (!isWindowOpen(minute, window)) return { kind: "closed", localDate: progress.localDate, reason: "outside_window" };
 for (const dimension of CHECKIN_DIMENSIONS) {
  if (progress.answered.includes(dimension) || progress.skipped.includes(dimension)) continue;
  return { kind: "ask", dimension, localDate: progress.localDate };
 }
 const everyAnswered = CHECKIN_DIMENSIONS.every(dimension => progress.answered.includes(dimension));
 return { kind: "complete", localDate: progress.localDate, reason: everyAnswered ? "all_answered" : "resolved_with_skips" };
}

// Phrasing is deterministic and anchored to the registry; a model may later rephrase, but not change the dimension.
export function questionFor(dimension: CheckinDimension): string {
 if (dimension === "illness") return "Do you have any illness symptoms this morning? Answer yes or no.";
 const entry = SubjectiveEventRegistry[dimension];
 const anchors = "anchors" in entry ? entry.anchors : null;
 const label = entry.label.toLowerCase();
 return anchors
  ? `How is your ${label} this morning, from 0 (${anchors.low.toLowerCase()}) to 10 (${anchors.high.toLowerCase()})?`
  : `How is your ${label} this morning?`;
}
