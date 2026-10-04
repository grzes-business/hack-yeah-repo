"use client";

import { useEffect, useState } from "react";
import { useHealthSession } from "./session";
import type { CheckinDimension } from "@/lib/checkin/controller";
import { useTalkContext } from "./talk-context";
import { HEALTH_HISTORY_CHANGED } from "./voice-conversation";

type Step =
 | { kind: "ask"; dimension: CheckinDimension; localDate: string; question: string }
 | { kind: "complete"; localDate: string; reason: "all_answered" | "resolved_with_skips" | "ended" }
 | { kind: "closed"; localDate: string; reason: "outside_window" | "ended" };
type Checkin = {
 localDate: string;
 window: { opensAt: string; closesAt: string; open: boolean };
 answered: CheckinDimension[];
 skipped: CheckinDimension[];
 ended: boolean;
 step: Step;
};

// TEMPORARY test window. Remove with the marked lines, lib/checkin/dev-window.ts, and the header in app/api/checkin/route.ts.
const DEV_WINDOW_KEY = "checkin-dev-window";
const DEV_WINDOW_HEADER = "x-checkin-dev-window";
const isDevBuild = process.env.NODE_ENV !== "production";
function savedDevWindow(): string | null {
 if (!isDevBuild || typeof window === "undefined") return null;
 try { return window.localStorage.getItem(DEV_WINDOW_KEY); } catch { return null; }
}

const labels: Record<CheckinDimension, string> = { energy: "Energy", soreness: "Soreness", mood: "Mood", illness: "Illness symptoms" };

function statusText(step: Step, window: Checkin["window"]) {
 if (step.kind === "ask") return "Next question:";
 if (step.kind === "complete") return step.reason === "resolved_with_skips" ? "Check-in complete. Skipped questions stay unknown." : "Check-in complete for today.";
 if (step.reason === "ended") return "Check-in ended for today.";
 return `Morning check-in is open from ${window.opensAt} to ${window.closesAt} your local time.`;
}

// Questions are chosen by the server's deterministic controller. Answers are given in the voice conversation and
// saved as ordinary reports; this card reads back accepted observations rather than trusting what was said.
export function MorningCheckin() {
 const { session } = useHealthSession();
 const talk=useTalkContext();
 const [checkin, setCheckin] = useState<Checkin | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState(false);
 // TEMPORARY test window state.
 const [devWindow, setDevWindow] = useState<string | null>(savedDevWindow);
 const [devFrom, setDevFrom] = useState("00:00");
 const [devTo, setDevTo] = useState("23:59");
 const token = session?.access_token;

 function devHeaders(): Record<string, string> {
  return devWindow ? { [DEV_WINDOW_HEADER]: devWindow } : {};
 }

 function applyDevWindow() {
  const value = `${devFrom}-${devTo}`;
  try { window.localStorage.setItem(DEV_WINDOW_KEY, value); } catch { /* Test-only convenience. */ }
  setDevWindow(value);
 }

 function clearDevWindow() {
  try { window.localStorage.removeItem(DEV_WINDOW_KEY); } catch { /* Test-only convenience. */ }
  setDevWindow(null);
 }

 async function request(method: "GET" | "POST" | "DELETE", body?: unknown) {
  if (!token) return;
  setBusy(true);
  try {
   const response = await fetch("/api/checkin", { method, headers: { Authorization: `Bearer ${token}`, ...devHeaders(), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
   const json = await response.json();
   if (!response.ok) throw new Error(json.error ?? "Morning check-in could not update.");
   setCheckin(json.checkin as Checkin);
   if(method!=="GET"&&talk.context.mode==="morning_checkin"){
    const next=json.checkin as Checkin;
    if(next.step.kind==="ask")talk.select({mode:"morning_checkin",date:next.localDate,dimension:next.step.dimension},next.step.question);
    else talk.select({mode:"report"},"Morning check-in finished. You can report observations normally.");
   }
   setError(null);
  } catch (caught) {
   setError(caught instanceof Error ? caught.message : "Morning check-in could not update.");
  } finally {
   setBusy(false);
  }
 }

 useEffect(() => {
  if (!token) return;
  let active = true;
  const load = () => {
   fetch("/api/checkin", { headers: { Authorization: `Bearer ${token}`, ...(devWindow ? { [DEV_WINDOW_HEADER]: devWindow } : {}) } })
    .then(async response => {
     const json = await response.json();
     if (!response.ok) throw new Error(json.error ?? "Morning check-in could not load.");
     if (active) { setCheckin(json.checkin as Checkin); setError(null); }
    })
    .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Morning check-in could not load."); });
  };
  load();
  // A voice answer saved elsewhere on the page re-reads accepted observations without a manual Refresh.
  window.addEventListener(HEALTH_HISTORY_CHANGED, load);
  return () => { active = false; window.removeEventListener(HEALTH_HISTORY_CHANGED, load); };
 }, [token, devWindow]);

 if (!session) return null;
 return (
  <section className="card card-body bg-base-100 border border-base-300" aria-label="Morning check-in">
   <h2>Morning check-in</h2>
   {isDevBuild && (
    <details className="small">
     <summary>Test window (temporary, dev only){devWindow ? ` · active ${devWindow}` : ""}</summary>
     <label>From <input className="input w-full" type="time" value={devFrom} onChange={event => setDevFrom(event.target.value)} /></label>{" "}
     <label>To <input className="input w-full" type="time" value={devTo} onChange={event => setDevTo(event.target.value)} /></label>{" "}
     <button className="btn btn-primary" onClick={applyDevWindow} disabled={!devFrom || !devTo || devFrom >= devTo}>Apply window</button>{" "}
     <button className="btn btn-primary" onClick={clearDevWindow} disabled={!devWindow}>Use real window</button>
     <p className="small">Dev only. Reset clears today&apos;s skips and end marker and deletes today&apos;s energy, soreness, mood and illness answers. Capture history stays.</p>
     <button className="btn btn-primary" onClick={() => { if (window.confirm("Reset today's check-in? This deletes today's energy, soreness, mood and illness answers.")) void request("DELETE"); }} disabled={busy}>Reset today&apos;s check-in and answers</button>
    </details>
   )}
   {checkin ? (
    <>
     <p role="status">{statusText(checkin.step, checkin.window)}</p>
     {checkin.step.kind === "ask" && <>
      <p><strong>{checkin.step.question}</strong></p>
      <p className="small">Answer by voice. Say “I don’t know” or “skip” to leave a value unknown.</p>
      <button className="btn btn-primary" disabled={busy} onClick={()=>{if(checkin.step.kind==="ask"){talk.select({mode:"morning_checkin",date:checkin.localDate,dimension:checkin.step.dimension},checkin.step.question);document.getElementById("voice-controls")?.scrollIntoView({behavior:"smooth",block:"start"});}}}>Start / resume spoken check-in</button>
      <div className="voice-actions">
       <button className="btn btn-primary" onClick={() => void request("POST", { action: "skip", dimension: checkin.step.kind === "ask" ? checkin.step.dimension : undefined })} disabled={busy}>Skip this question</button>
       <button className="btn btn-primary" onClick={() => void request("POST", { action: "end" })} disabled={busy}>End check-in for today</button>
       <button className="btn btn-primary" onClick={() => void request("GET")} disabled={busy}>Refresh</button>
      </div>
     </>}
     {checkin.step.kind !== "ask" && <button className="btn btn-primary" onClick={() => void request("GET")} disabled={busy}>Refresh</button>}
     <p className="small">Answered: {checkin.answered.length ? checkin.answered.map(d => labels[d]).join(", ") : "none yet"}. Skipped: {checkin.skipped.length ? checkin.skipped.map(d => labels[d]).join(", ") : "none"}.</p>
    </>
   ) : <p role="status">{busy ? "Loading check-in…" : "Check-in not loaded yet."}</p>}
   {error && <p role="alert">{error}</p>}
  </section>
 );
}
