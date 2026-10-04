import { CHECKIN_DIMENSIONS, type CheckinDimension } from "./controller";

/** Dimensions still open today, in check-in order. */
export function pendingDimensions(answered: readonly string[], skipped: readonly string[]): CheckinDimension[] {
  return CHECKIN_DIMENSIONS.filter(d => !answered.includes(d) && !skipped.includes(d));
}

/** One spoken prompt covering every dimension still open, so a single sentence can answer them all. */
export function morningPrompt(pending: readonly CheckinDimension[]) {
  const ratings = pending.filter(d => d !== "illness");
  const parts = [
    ratings.length ? `${ratings.join(", ").replace(/, ([^,]*)$/, " and $1")} from 0 to 10` : "",
    pending.includes("illness") ? "are you feeling ill" : "",
  ].filter(Boolean);
  return parts.length ? `In one sentence: ${parts.join(", and ")}?` : "Anything else about this morning?";
}
