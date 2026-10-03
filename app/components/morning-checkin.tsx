"use client";

import { useEffect, useState } from "react";
import { useHealthSession } from "./session";
import type { CheckinDimension } from "@/lib/checkin/controller";

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
 const [checkin, setCheckin] = useState<Checkin | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState(false);
 const token = session?.access_token;

 async function request(method: "GET" | "POST", body?: unknown) {
  if (!token) return;
  setBusy(true);
  try {
   const response = await fetch("/api/checkin", { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
   const json = await response.json();
   if (!response.ok) throw new Error(json.error ?? "Morning check-in could not update.");
   setCheckin(json.checkin as Checkin);
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
  fetch("/api/checkin", { headers: { Authorization: `Bearer ${token}` } })
   .then(async response => {
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Morning check-in could not load.");
    if (active) { setCheckin(json.checkin as Checkin); setError(null); }
   })
   .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Morning check-in could not load."); });
  return () => { active = false; };
 }, [token]);

 if (!session) return null;
 return (
  <section className="card" aria-label="Morning check-in">
   <h2>Morning check-in</h2>
   {checkin ? (
    <>
     <p role="status">{statusText(checkin.step, checkin.window)}</p>
     {checkin.step.kind === "ask" && <>
      <p><strong>{checkin.step.question}</strong></p>
      <p className="small">Answer aloud in the conversation below. The answer is saved as a normal report and counted here after you refresh.</p>
      <div className="voice-actions">
       <button onClick={() => void request("POST", { action: "skip", dimension: checkin.step.kind === "ask" ? checkin.step.dimension : undefined })} disabled={busy}>Skip this question</button>
       <button onClick={() => void request("POST", { action: "end" })} disabled={busy}>End check-in for today</button>
       <button onClick={() => void request("GET")} disabled={busy}>Refresh</button>
      </div>
     </>}
     {checkin.step.kind !== "ask" && <button onClick={() => void request("GET")} disabled={busy}>Refresh</button>}
     <p className="small">Answered: {checkin.answered.length ? checkin.answered.map(d => labels[d]).join(", ") : "none yet"}. Skipped: {checkin.skipped.length ? checkin.skipped.map(d => labels[d]).join(", ") : "none"}.</p>
    </>
   ) : <p role="status">{busy ? "Loading check-in…" : "Check-in not loaded yet."}</p>}
   {error && <p role="alert">{error}</p>}
  </section>
 );
}
