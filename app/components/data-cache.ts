"use client";
import { AnalyticsReportSchema, type AnalyticsReport } from "@/lib/analytics/contracts";
import { addCalendarDays, DailyFeaturesSchema, type DailyFeatures } from "@/lib/domain";

/**
 * Per-tab, in-memory prefetch cache. Keys include the owner, inputs and the
 * history revision, so any new observation produces a new key instead of
 * serving stale evidence. Failed loads are evicted so a retry fetches again.
 */
const cache = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const promise = load().catch(error => { cache.delete(key); throw error; });
  cache.set(key, promise);
  return promise;
}

export type EvidenceData = { report: AnalyticsReport; days: DailyFeatures[] };
export const evidenceKey = (owner: string, date: string, scope: string, revision: number) => `evidence:${owner}:${date}:${scope}:${revision}`;

/** Analytics for a day (computed if missing) plus the 7-day trend rows. */
export async function loadEvidence(token: string, date: string, scope: string): Promise<EvidenceData> {
  const headers = { Authorization: `Bearer ${token}` };
  let response = await fetch(`/api/analytics?${new URLSearchParams({ date, scope })}`, { headers });
  let body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Evidence could not load.");
  if (body.needsAnalysis) {
    response = await fetch("/api/analytics", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ date, scope }) });
    body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Evidence could not load.");
  }
  const report = AnalyticsReportSchema.parse(body.report);
  const trend = await fetch(`/api/features?${new URLSearchParams({ from: addCalendarDays(date, -6), to: date, scope })}`, { headers });
  const days = trend.ok ? ((await trend.json()).rows as unknown[]).map(row => DailyFeaturesSchema.parse(row)) : [];
  return { report, days };
}

export const experimentsKey = (owner: string, revision: number) => `experiments:${owner}:${revision}`;
/** Replace a cached value after a local mutation (e.g. an experiment action). */
export function prime<T>(key: string, value: T) { cache.set(key, Promise.resolve(value)); }

/** GET /api/experiments, throwing on failure so errors are never cached. */
export async function loadExperiments(token: string): Promise<{ experiments: unknown[] }> {
  const response = await fetch("/api/experiments", { headers: { Authorization: `Bearer ${token}` } });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Experiments are unavailable.");
  return { experiments: json.experiments };
}
export const historyKey = (owner: string, revision: number) => `history:${owner}:${revision}`;
