"use client";
import { FlaskIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { ExperimentResult } from "@/lib/experiments/compare";
import type { ExperimentEvent, ExperimentPlan, ExperimentStatus } from "@/lib/experiments/contracts";
import { formatDate, formatPeriod } from "@/lib/format";
import { useHealthSession } from "./session";
import { useTalkContext } from "./talk-context";

type View = { plan: ExperimentPlan; status: ExperimentStatus; events: ExperimentEvent[]; result: ExperimentResult | null; resultError?: string };
type Scope = "personal" | "demo";
const TARGET_HOURS = 7.5, PERIOD_DAYS = 14;
const fmt = (v: number | null | undefined, digits = 1) => v === null || v === undefined ? "unknown" : Number(v.toFixed(digits)).toString();
const stat = (v: number | null) => v === null ? "—" : fmt(v);
const signed = (v: number) => `${v > 0 ? "+" : ""}${fmt(v)}`;

async function request(token: string, body?: object): Promise<{ experiments: View[] } | { error: string }> {
  try {
    const response = await fetch("/api/experiments", {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json();
    return response.ok ? { experiments: json.experiments } : { error: json.error ?? "Experiments are unavailable." };
  } catch { return { error: "Experiments are unavailable. Check your connection and retry." }; }
}

export function Experiments() {
  const { session, historyRevision } = useHealthSession();
  // Follows the app-wide data source chosen on Today/Insights.
  const { scope } = useTalkContext();
  const [views, setViews] = useState<View[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loads on mount and whenever history changes; state is set only in async callbacks.
  useEffect(() => {
    if (!session) return;
    let active = true;
    request(session.access_token).then(r => { if (!active) return; if ("error" in r) setError(r.error); else { setError(null); setViews(r.experiments); } });
    return () => { active = false; };
  }, [session, historyRevision]);

  async function act(body: object) {
    if (!session || busy) return;
    setBusy(true); setError(null);
    const r = await request(session.access_token, body);
    if ("error" in r) setError(r.error); else setViews(r.experiments);
    setBusy(false);
  }
  if (!session) return null;

  const open = views?.find(v => v.plan.scope === scope && (v.status === "active" || v.status === "paused"));
  const past = views?.filter(v => v.status === "completed" || v.status === "abandoned") ?? [];

  return <section className="card card-body bg-base-100 border border-base-300 experiment-card" aria-labelledby="experiment-heading">
    <div className="section-heading"><h2 id="experiment-heading"><FlaskIcon size={20} aria-hidden="true" /> Personal experiment</h2><span>Observation, not treatment</span></div>
    <p className="small">Using {scope === "demo" ? "synthetic demo history" : "your personal history"} (change the data source at the top of Insights).</p>
    {error && <p role="alert">{error}</p>}
    {!views && !error && <p role="status">Loading experiments…</p>}
    {views && !open && <Proposal scope={scope} busy={busy} onAccept={() => void act({ action: "accept", templateId: "sleep_target__energy", scope })} />}
    {open && <Active view={open} busy={busy} act={action => void act({ action, id: open.plan.id })} />}
    {past.length > 0 && <details><summary>Past experiments ({past.length})</summary>{past.map(v => <div key={v.plan.id} className="experiment-past"><p><strong>{v.status === "completed" ? "Completed" : "Abandoned"}</strong> · <span className="nowrap">{formatPeriod(v.plan.intervention.from, v.plan.intervention.to)}</span> · {v.plan.scope === "demo" ? "synthetic" : "personal"}</p>{v.result && <ResultSummary result={v.result} />}</div>)}</details>}
  </section>;
}

function Proposal({ scope, busy, onAccept }: { scope: Scope; busy: boolean; onAccept: () => void }) {
  return <div className="experiment-proposal">
    <p className="eyebrow">Proposed plan · sleep → energy</p>
    <h3>Sleep at least {TARGET_HOURS} hours, then rate your energy</h3>
    <ul className="experiment-rules">
      <li><strong>{PERIOD_DAYS} days</strong> aiming for ≥ {TARGET_HOURS} h of recorded sleep, compared with the {PERIOD_DAYS} days before.</li>
      <li><strong>Primary:</strong> your spoken energy rating (0–10). <strong>Secondary:</strong> HRV from Apple Health.</li>
      <li>A day counts only if recorded sleep met the target that night. Unknown days are excluded, never guessed.</li>
      <li>Needs at least 5 days with an energy rating in each period, otherwise the result stays inconclusive.</li>
      <li>We also list reported illness, stress and previous-day alcohol, which can explain differences.</li>
    </ul>
    {scope === "demo"
      ? <p className="small">Synthetic demo: evaluated retrospectively over the last {PERIOD_DAYS} days of fictional sample history. Load sample history on Today first.</p>
      : <p className="small">Starts today. Nothing changes automatically; you choose your bedtime. This is a personal observation, not medical advice or a trial.</p>}
    <button className="btn btn-primary" disabled={busy} onClick={onAccept}>{busy ? "Starting…" : scope === "demo" ? "Run the demo experiment" : "I agree, start the experiment"}</button>
  </div>;
}

function Active({ view, busy, act }: { view: View; busy: boolean; act: (a: "pause" | "resume" | "complete" | "abandon") => void }) {
  const { plan, status, result } = view;
  const day = result ? Math.min(PERIOD_DAYS, result.intervention.eligibleDays + result.intervention.pausedDays) : 0;
  return <div className="experiment-active">
    <div className="experiment-status">
      <span className={`badge badge-soft ${status === "paused" ? "badge-warning" : "badge-success"}`}>{status === "paused" ? "Paused" : "Active"}</span>
      {plan.retrospectiveDemo && <span className="badge badge-soft badge-info">Synthetic · retrospective</span>}
      <span className="small nowrap">{formatPeriod(plan.intervention.from, plan.intervention.to)}</span>
    </div>
    <p className="experiment-day">Day <strong>{day}</strong> of {PERIOD_DAYS}</p>
    <progress className="progress progress-primary w-full" value={day} max={PERIOD_DAYS} aria-label={`Day ${day} of ${PERIOD_DAYS}`} />
    {view.resultError && <p role="alert">{view.resultError}</p>}
    {result && <ResultSummary result={result} />}
    <div className="button-row">
      {status === "active" && <button className="btn btn-soft" disabled={busy} onClick={() => act("pause")}>Pause</button>}
      {status === "paused" && <button className="btn btn-primary" disabled={busy} onClick={() => act("resume")}>Resume</button>}
      <button className="btn btn-soft" disabled={busy} onClick={() => act("complete")}>Finish now</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => act("abandon")}>Abandon</button>
    </div>
  </div>;
}

function ResultSummary({ result }: { result: ExperimentResult }) {
  const { baseline: b, intervention: i } = result;
  const headline = result.state === "in_progress" ? "So far" : result.state === "descriptive" ? "Result" : "Inconclusive";
  return <div className="experiment-result">
    <div className="experiment-stats">
      <div><span className="small">Nights ≥ {TARGET_HOURS} h</span><strong>{i.adherentNights}<small> / {i.sleepKnown} recorded</small></strong></div>
      <div><span className="small">Energy before</span><strong>{stat(b.energyMedian)}<small> median · {b.energyDays} d</small></strong></div>
      <div><span className="small">Energy on target nights</span><strong>{stat(i.energyMedian)}<small> median · {i.energyDays} d</small></strong></div>
    </div>
    <p><strong>{headline}:</strong> {result.energyDifference === null
      ? `not enough days yet to compare (${b.energyDays} before, ${i.energyDays} on target).`
      : `energy ${signed(result.energyDifference)} points on target nights${result.energyRelativeDifference !== null ? ` (${signed(result.energyRelativeDifference * 100)}%)` : ""}.`}
      {result.hrvDifference !== null && ` HRV ${signed(result.hrvDifference)} ms.`}</p>
    <details><summary>Counts, missing days and limitations</summary><ul>
      <li>Before: {b.days} days, {b.missingEnergy} without energy, {b.nightsMeetingTarget} already met the target, {b.illnessDays} illness, {b.alcoholPreviousDays} after alcohol, stress median {fmt(b.stressMedian)}.</li>
      <li>During: {i.eligibleDays} eligible days, {i.missingSleep} without recorded sleep, {i.pausedDays} paused, {i.illnessDays} illness, {i.alcoholPreviousDays} after alcohol on target days.</li>
      <li>Evaluated through {formatDate(result.evaluatedThrough, true)}.</li>
      {result.limitations.map(l => <li key={l}>{l}</li>)}
    </ul></details>
  </div>;
}
