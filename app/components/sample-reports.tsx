"use client";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { addCalendarDays, getLocalDate } from "@/lib/domain";
import { SAMPLE_REPORT_DAYS, seedSampleReports } from "@/lib/demo/sample-reports";
import { useHealthSession } from "./session";

/**
 * Opt-in fictional voice reports for the last 30 days, saved in personal history
 * next to real Apple Health data and labeled "sample" wherever they appear.
 */
export function SampleReports({ compact = false }: { compact?: boolean }) {
  const { repository, profile, refreshHistory } = useHealthSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  if (!repository || !profile) return null;
  const options = { endDate: addCalendarDays(getLocalDate(new Date().toISOString(), profile.time_zone), -1), timeZone: profile.time_zone, days: SAMPLE_REPORT_DAYS, seed: 2026 };

  async function run(remove: boolean) {
    if (!repository || busy) return;
    setBusy(true); setMessage(null);
    try {
      if (remove) { await repository.removeSampleReports(options); setMessage({ text: "Sample reports removed. Your real data is untouched.", failed: false }); }
      else { const result = await seedSampleReports(repository, options); setMessage({ text: `${result.events} sample reports added for ${result.fromDate} to ${result.toDate}. Adding again creates no duplicates.`, failed: false }); }
    } catch {
      setMessage({ text: remove ? "Removal did not finish. Try again." : "Sample reports were not fully added. Try again; nothing is duplicated.", failed: true });
    } finally { refreshHistory(); setBusy(false); }
  }

  return <section className={compact ? "sample-reports compact" : "card card-body bg-base-100 border border-base-300 sample-reports"} aria-labelledby="sample-reports-heading">
    <span className="badge badge-soft badge-warning">Fictional · labeled “sample”</span>
    <h2 id="sample-reports-heading"><ChatCircleDotsIcon size={20} aria-hidden="true" /> Sample voice reports</h2>
    <p>No reports yet? Add {SAMPLE_REPORT_DAYS} days of fictional energy, mood, soreness, stress, alcohol and similar reports next to your real measurements, so Insights and experiments have something to compare. They never change your Apple Health data and can be removed in one tap.</p>
    <div className="button-row">
      <button className="btn btn-primary" disabled={busy} onClick={() => void run(false)}>{busy ? "Working…" : "Add sample reports"}</button>
      <button className="btn btn-soft" disabled={busy} onClick={() => void run(true)}>Remove sample reports</button>
    </div>
    {message && <p role={message.failed ? "alert" : "status"}>{message.text}</p>}
  </section>;
}
