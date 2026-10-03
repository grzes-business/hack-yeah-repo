import { createHash } from "node:crypto";
import { addCalendarDays, getLocalDate, LocalDateSchema, ExtractionDraftResultSchema, ExtractionResultSchema, SubjectiveEventDraftSchema, SubjectiveEventSchema, type ExtractionResult } from "../domain";
import { ProviderExtractionSchema, type CandidateSchema } from "./contracts";
import type { z } from "zod";

type Candidate = z.infer<typeof CandidateSchema>;
export type CaptureContext = { rootTurnId: string; sourceTurnId: string; anchorAt: string; capturedAt: string; timeZone: string };

function clockInstant(date: string, clock: string, zone: string): string {
 if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) throw new Error("Please specify the time as hours and minutes.");
 const target = `${date}T${clock}:00`;
 const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
 const wall = (instant: number) => { const parts = formatter.formatToParts(new Date(instant)); const p = (key: Intl.DateTimeFormatPartTypes) => parts.find(v => v.type === key)!.value; return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}`; };
 const base = Date.parse(`${target}Z`); const offsets = new Set<number>();
 for (let h = -36; h <= 36; h += 6) { const instant = base + h * 3600000; offsets.add(Date.parse(`${wall(instant)}Z`) - instant); }
 const candidates = [...offsets].map(offset => base - offset).filter(instant => wall(instant) === target);
 if (candidates.length !== 1) throw new Error("That local time is ambiguous or unavailable because of a clock change. Please specify a different time.");
 return new Date(candidates[0]).toISOString();
}
function occurredAt(timing: Candidate["timing"], context: CaptureContext): string {
 const today = getLocalDate(context.anchorAt, context.timeZone);
 if (timing.kind !== "days_ago" && timing.daysAgo !== null || timing.kind !== "date" && timing.date !== null) throw new Error("The observation date needs clarification.");
 const date = timing.kind === "date" ? LocalDateSchema.parse(timing.date) : timing.kind === "yesterday" ? addCalendarDays(today, -1) : timing.kind === "days_ago" ? addCalendarDays(today, -(timing.daysAgo ?? NaN)) : today;
 if (date > today) throw new Error("This describes a future plan, not a completed observation. Please clarify the date.");
 // Date-only past reports use a representative noon, not an inferred actual clock.
 const instant = timing.clock ? clockInstant(date, timing.clock, context.timeZone) : date === today ? context.anchorAt : clockInstant(date, "12:00", context.timeZone);
 if (Date.parse(instant) > Date.parse(context.capturedAt)) throw new Error("The observation time is after capture. Please clarify the time.");
 return instant;
}
function valueFor(candidate: Candidate) {
 const allowed: Record<Candidate["type"], string[]> = { energy:["rating"], stress:["rating"], mood:["rating"], soreness:["rating"], workout_rpe:["rating"], alcohol:["consumed","quantity","beverage"], caffeine:["consumed","amountMg"], pain:["present","location","intensity"], late_meal:["booleanValue"], illness:["booleanValue"] };
 for (const [key, value] of Object.entries(candidate)) if (key !== "type" && key !== "timing" && !allowed[candidate.type].includes(key) && value !== null) throw new Error("Unexpected candidate field.");
 switch(candidate.type) {
  case "energy": case "stress": case "mood": case "soreness": case "workout_rpe": return candidate.rating;
  case "late_meal": case "illness": return candidate.booleanValue;
  case "alcohol": return { consumed: candidate.consumed, quantity: candidate.quantity, unit: "reported_drinks", ...(candidate.beverage ? { beverage: candidate.beverage } : {}) };
  case "caffeine": return { consumed: candidate.consumed, amountMg: candidate.amountMg };
  case "pain": return { present: candidate.present, location: candidate.location, intensity: candidate.intensity };
 }
}
export function canonicalizeExtraction(input: unknown, context: CaptureContext): ExtractionResult {
 const response = ProviderExtractionSchema.parse(input);
 if (response.status !== "captured") {
  if (response.events.length || !response.reason?.trim()) throw new Error("Invalid empty/clarification outcome.");
  if (response.status === "needs_clarification") return ExtractionResultSchema.parse({ status: response.status, eventType: response.eventType, reason: response.reason });
  if (response.eventType !== null) throw new Error("Unexpected event type.");
  return ExtractionResultSchema.parse({ status: response.status, reason: response.reason });
 }
 if (response.reason !== null || response.eventType !== null || !response.events.length) throw new Error("Invalid captured outcome.");
 const drafts = [];
 for (const event of response.events) {
  const value = valueFor(event);
  // Validate value semantics before handling temporal clarification.
  SubjectiveEventDraftSchema.parse({ type:event.type, value, occurredAt:context.anchorAt, extractionConfidence:null });
  let time;
  try { time = occurredAt(event.timing, context); }
  catch (error) { return ExtractionResultSchema.parse({ status:"needs_clarification", eventType:event.type, reason:error instanceof Error ? error.message.slice(0,500) : "Please clarify the date and time." }); }
  drafts.push({ type:event.type, value, occurredAt:time, extractionConfidence:null });
 }
 const parsed = ExtractionDraftResultSchema.parse({ status:"captured", events:drafts });
 if (parsed.status !== "captured") throw new Error("Unexpected extraction outcome.");
 const seen = new Set<string>();
 const events = parsed.events.filter(event => { const key = JSON.stringify(event); if (seen.has(key)) return false; seen.add(key); return true; }).map((draft,index) => SubjectiveEventSchema.parse({
  ...draft, id:`capture:v1:${createHash("sha256").update(context.rootTurnId + ":" + context.sourceTurnId).digest("hex").slice(0,40)}:${index}`,
  capturedAt:context.capturedAt, timeZone:context.timeZone, conversationTurnId:context.sourceTurnId,
 }));
 return ExtractionResultSchema.parse({ status:"captured", events });
}
