"use client";
import { useState } from "react";
import Link from "next/link";
import { addCalendarDays, getLocalDate } from "@/lib/domain";
import { seedDemoHistory } from "@/lib/demo/seed";
import { useHealthSession } from "./session";

export function DemoHistory() {
  const { profile } = useHealthSession();
  return profile ? <Controls key={profile.time_zone} timeZone={profile.time_zone} /> : null;
}
function Controls({ timeZone }: { timeZone: string }) {
  const { repository, refreshHistory } = useHealthSession();
  const latestDate = addCalendarDays(getLocalDate(new Date().toISOString(), timeZone), -1);
  const [endDate, setEndDate] = useState(latestDate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const options = { endDate, timeZone, days: 56, seed: 2026 };
  async function run(remove: boolean) {
    if (!repository || busy) return;
    setBusy(true); setMessage(null); setFailed(false);
    try {
      if (remove) {
        await repository.removeDemoHistory(options);
        setMessage("Sample history removed. Other observations are kept.");
      } else {
        const result = await seedDemoHistory(repository, options);
        setMessage(`Sample history ready: ${result.days} days, ${result.metrics} wearable measurements and ${result.events} synthetic observations. Loading the same history again adds no duplicates.`);
      }
    } catch {
      setFailed(true);
      setMessage(remove ? "Sample removal did not finish. Try again." : "History could not be fully loaded. Some samples may have been saved; load the same history again to finish.");
    } finally { refreshHistory(); setBusy(false); }
  }
  return <section className="card" aria-labelledby="sample-history-heading">
    <span className="badge">Synthetic demo</span>
    <h2 id="sample-history-heading">Explore 56 days of sample history</h2>
    <p>Try wearable measurements alongside sample reports of energy, stress, and habits. These are fictional observations, with deliberate gaps. They are not your health data.</p>
    <label htmlFor="history-end-date">Last day of sample history</label>
    <input id="history-end-date" type="date" value={endDate} max={latestDate} required disabled={busy} onChange={event => setEndDate(event.target.value)} />
    <p className="small">Time zone: {timeZone}. Repeated loads are safe. Removal clears this demo’s samples for this time zone.</p>
    <div className="button-row"><button onClick={() => run(false)} disabled={busy || !endDate || endDate > latestDate}>{busy ? "Working…" : "Load sample history"}</button><button className="secondary-button" onClick={() => run(true)} disabled={busy || !endDate || endDate > latestDate}>Remove sample history</button></div>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
    <Link className="text-link" href="/timeline">Open timeline →</Link>
  </section>;
}
