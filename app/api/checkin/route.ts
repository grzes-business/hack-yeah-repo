import { z } from "zod";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { parseEventRow } from "@/lib/db/ingestion";
import { addCalendarDays, getLocalDate, TimeZoneSchema, type LocalDate } from "@/lib/domain";
import { CHECKIN_DIMENSIONS, CHECKIN_WINDOW, getNextStep, isWindowOpen, localClock, questionFor, type CheckinDimension, type CheckinProgress } from "@/lib/checkin/controller";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
type Client = Awaited<ReturnType<typeof authenticatedDatabase>>["client"];

const ActionSchema = z.discriminatedUnion("action", [
 z.strictObject({ action: z.literal("skip"), dimension: z.enum(CHECKIN_DIMENSIONS) }),
 z.strictObject({ action: z.literal("end") }),
]);

// The server derives the owner and the local clock; the client never supplies a date or a window decision.
async function currentClock(client: Client, owner: string, now: Date) {
 const profile = await client.from("profiles").select("time_zone").eq("user_id", owner).single();
 if (profile.error || !profile.data) throw new RequestFailure("Your profile could not load.", 503);
 const timeZone = TimeZoneSchema.parse(profile.data.time_zone);
 return { timeZone, ...localClock(now.toISOString(), timeZone) };
}

// Answers are the accepted observations on the local date; the local date window covers UTC edges of one day.
async function answeredOn(client: Client, owner: string, localDate: LocalDate, timeZone: string) {
 const from = addCalendarDays(localDate, -1), to = addCalendarDays(localDate, 2);
 const rows = await client.from("subjective_events").select("*").eq("user_id", owner)
  .gte("observed_at", `${from}T00:00:00Z`).lt("observed_at", `${to}T00:00:00Z`)
  .not("id", "like", "demo:%").order("observed_at").order("id").limit(1000);
 if (rows.error) throw new RequestFailure("Saved reports could not load. Try again.", 503);
 const types = (rows.data ?? []).map(row => parseEventRow(row, owner)).filter(event => getLocalDate(event.occurredAt, timeZone) === localDate).map(event => event.type);
 return CHECKIN_DIMENSIONS.filter(dimension => types.includes(dimension));
}

async function stateOn(client: Client, owner: string, localDate: LocalDate) {
 const row = await client.from("morning_checkins").select("skipped,ended_at").eq("user_id", owner).eq("local_date", localDate).maybeSingle();
 if (row.error) throw new RequestFailure("Morning check-in state could not load. Apply migration 006.", 503);
 const skipped = (row.data?.skipped ?? []).filter((value): value is CheckinDimension => (CHECKIN_DIMENSIONS as readonly string[]).includes(value));
 return { skipped, ended: row.data?.ended_at != null };
}

async function loadCheckin(client: Client, owner: string, now = new Date()) {
 const clock = await currentClock(client, owner, now);
 const answered = await answeredOn(client, owner, clock.localDate, clock.timeZone);
 const { skipped, ended } = await stateOn(client, owner, clock.localDate);
 const progress: CheckinProgress = { localDate: clock.localDate, answered, skipped, ended };
 const step = getNextStep(progress, clock.minute);
 return {
  localDate: clock.localDate,
  timeZone: clock.timeZone,
  window: { opensAt: CHECKIN_WINDOW.opensAt, closesAt: CHECKIN_WINDOW.closesAt, open: isWindowOpen(clock.minute) },
  answered,
  skipped,
  ended,
  step: step.kind === "ask" ? { ...step, question: questionFor(step.dimension) } : step,
 };
}

export async function GET(request: Request) {
 try {
  const { client, owner } = await authenticatedDatabase(request);
  return Response.json({ checkin: await loadCheckin(client, owner) }, { headers });
 } catch (error) {
  return Response.json({ error: error instanceof RequestFailure ? error.message : "Morning check-in could not load." }, { status: error instanceof RequestFailure ? error.status : 503, headers });
 }
}

export async function POST(request: Request) {
 try {
  const { client, owner } = await authenticatedDatabase(request);
  const parsed = ActionSchema.safeParse(await boundedJson(request, 1000));
  if (!parsed.success) throw new RequestFailure("Invalid check-in action.", 400);
  const now = new Date();
  const clock = await currentClock(client, owner, now);
  const current = await loadCheckin(client, owner, now);
  if (parsed.data.action === "skip") {
   // A skip applies only to the question that is currently due, so a stale view cannot skip a later dimension.
   if (current.step.kind !== "ask" || current.step.dimension !== parsed.data.dimension) throw new RequestFailure("This question is no longer the next one. Refresh the check-in.", 409);
   const { skipped } = await stateOn(client, owner, clock.localDate);
   const next = [...new Set([...skipped, parsed.data.dimension])];
   const saved = await client.from("morning_checkins").upsert({ user_id: owner, local_date: clock.localDate, skipped: next, updated_at: now.toISOString() }, { onConflict: "user_id,local_date" });
   if (saved.error) throw new RequestFailure("The skip could not be saved. Try again.", 503);
  } else {
   const saved = await client.from("morning_checkins").upsert({ user_id: owner, local_date: clock.localDate, ended_at: now.toISOString(), updated_at: now.toISOString() }, { onConflict: "user_id,local_date" });
   if (saved.error) throw new RequestFailure("The check-in could not be ended. Try again.", 503);
  }
  return Response.json({ checkin: await loadCheckin(client, owner) }, { headers });
 } catch (error) {
  return Response.json({ error: error instanceof RequestFailure ? error.message : "Morning check-in could not be updated." }, { status: error instanceof RequestFailure ? error.status : 503, headers });
 }
}
