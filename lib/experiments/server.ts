import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { addCalendarDays, getLocalDate } from "../domain";
import type { Database } from "../db/database.types";
import { RequestFailure } from "../db/server";
import { featureWriter, readFeatureGeneration, readOwnedDailyFeatures, rebuildOwnedDailyFeatures } from "../features/server";
import { compareExperiment, type ExperimentResult } from "./compare";
import { createExperimentPlan, ExperimentEventSchema, ExperimentPlanSchema, ExperimentStatusSchema, ExperimentTransitions, type ExperimentAction, type ExperimentEvent, type ExperimentPlan, type ExperimentStatus } from "./contracts";

export interface ExperimentView { plan: ExperimentPlan; status: ExperimentStatus; events: ExperimentEvent[]; result: ExperimentResult | null; resultError?: string }
const MISSING_TABLE = "Experiments need migration 202610040011_experiments.sql in the Supabase SQL Editor.";
/** Postgres reports a missing table as 42P01; the Supabase REST layer as PGRST205. */
const missingTable = (code?: string) => code === "42P01" || code === "PGRST205";

function parseRow(row: Database["public"]["Tables"]["experiments"]["Row"], owner: string) {
  const plan = ExperimentPlanSchema.parse(row.plan);
  if (row.user_id !== owner || plan.id !== row.id || plan.scope !== row.scope) throw new Error("Experiment metadata mismatch");
  return { plan, status: ExperimentStatusSchema.parse(row.status), events: z.array(ExperimentEventSchema).parse(row.events) };
}

async function localToday(owner: string) {
  const { timeZone } = await readFeatureGeneration(featureWriter(), owner);
  return getLocalDate(new Date().toISOString(), timeZone);
}

/** Recomputed from current daily features on every read; nothing derived is stored. */
async function evaluate(client: SupabaseClient<Database>, owner: string, view: Omit<ExperimentView, "result">, today: string): Promise<ExperimentView> {
  const through = [view.plan.intervention.to, today].sort()[0];
  if (through < view.plan.baseline.from) return { ...view, result: null };
  const range = { from: addCalendarDays(view.plan.baseline.from, -1), to: through, scope: view.plan.scope };
  try {
    let history = await readOwnedDailyFeatures(client, owner, range);
    if (history.missingDates.length) history = { ...history, ...(await rebuildOwnedDailyFeatures(client, owner, range)), missingDates: [] };
    return { ...view, result: compareExperiment(view.plan, view.status, view.events, history.rows, today) };
  } catch (error) {
    return { ...view, result: null, resultError: error instanceof RequestFailure ? error.message : "The comparison could not be computed right now. Retry." };
  }
}

export async function listExperiments(client: SupabaseClient<Database>, owner: string) {
  const rows = await client.from("experiments").select("*").eq("user_id", owner).order("created_at", { ascending: false }).limit(20);
  if (rows.error) throw new RequestFailure(missingTable(rows.error.code) ? MISSING_TABLE : "Experiments could not load.", 503);
  const today = await localToday(owner);
  const views = rows.data.map(row => parseRow(row, owner));
  return { today, experiments: await Promise.all(views.map(v => evaluate(client, owner, v, today))) };
}

export async function applyExperimentAction(owner: string, action: ExperimentAction) {
  const writer = featureWriter(), now = new Date().toISOString(), today = await localToday(owner);
  if (action.action === "accept") {
    const plan = createExperimentPlan({ id: randomUUID(), scope: action.scope, today, acceptedAt: now });
    const events: ExperimentEvent[] = [{ type: "accepted", at: now, date: today }];
    const saved = await writer.from("experiments").insert({ user_id: owner, id: plan.id, scope: plan.scope, status: "active", plan, events });
    if (saved.error?.code === "23505") throw new RequestFailure("You already have an open experiment for this data source. Finish or abandon it first.", 409);
    if (saved.error) throw new RequestFailure(missingTable(saved.error.code) ? MISSING_TABLE : "The experiment was not saved. Retry.", 503);
    return;
  }
  const current = await writer.from("experiments").select("*").eq("user_id", owner).eq("id", action.id).maybeSingle();
  if (current.error) throw new RequestFailure(missingTable(current.error.code) ? MISSING_TABLE : "The experiment could not load.", 503);
  if (!current.data) throw new RequestFailure("Experiment not found.", 404);
  const view = parseRow(current.data, owner), rule = ExperimentTransitions[action.action];
  if (!rule.from.includes(view.status)) throw new RequestFailure(`A ${view.status} experiment cannot be ${rule.event}.`, 409);
  // Optimistic transition: only applies if nobody changed the status meanwhile.
  const updated = await writer.from("experiments")
    .update({ status: rule.to, events: [...view.events, { type: rule.event, at: now, date: today }], updated_at: now })
    .eq("user_id", owner).eq("id", action.id).eq("status", view.status).select("id");
  if (updated.error) throw new RequestFailure("The change was not saved. Retry.", 503);
  if (!updated.data.length) throw new RequestFailure("The experiment changed meanwhile. Reload and retry.", 409);
}
