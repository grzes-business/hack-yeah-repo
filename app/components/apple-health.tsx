"use client";
import { Capacitor } from "@capacitor/core";
import { HeartbeatIcon } from "@phosphor-icons/react";
import { useState, useSyncExternalStore } from "react";
import { Metrics, MetricRegistry, type MetricSample } from "@/lib/domain";
import { APPLE_READ_TYPES, AppleHealthDataSource, type AppleHealthClient, type AppleMetricStatus } from "@/lib/health/apple-health";
import { ingestHealthData } from "@/lib/health/ingestion";
import { useHealthSession } from "./session";

/** History window read on each sync; re-syncing the same days is idempotent. */
const SYNC_DAYS = 30;
const DAY_MS = 24 * 3600000;
/** HRV, resting HR, sleep, steps, active energy, workouts. */
const READ_GROUPS = 6;

const noop = () => () => {};
const lastSyncKey = (userId: string) => `apple-health-last-sync:${userId}`;
function readLastSync(userId: string | undefined) {
  if (!userId) return null;
  try { return localStorage.getItem(lastSyncKey(userId)); } catch { return null; }
}
/** True only inside the iOS shell with the Health plugin compiled in. */
function useNativeHealth() {
  return useSyncExternalStore(noop, () => Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("Health"), () => false);
}

/**
 * The Capacitor plugin proxy answers every property, including `then`, so it
 * must never be returned from an async function or awaited directly: the
 * promise machinery would call `Health.then` and hang forever. Wrap it.
 */
async function loadClient(): Promise<{ client: AppleHealthClient }> {
  const { Health } = await import("@capgo/capacitor-health");
  return { client: Health as unknown as AppleHealthClient };
}

const describe: Record<AppleMetricStatus["status"], string> = {
  records: "records",
  no_records: "nothing readable (no history, or access not allowed)",
  unsupported: "not available from Apple Health yet",
  failed: "could not be read",
};

export function AppleHealthSync() {
  const native = useNativeHealth();
  const { repository, session, refreshHistory } = useHealthSession();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ stored: number; report: AppleMetricStatus[] } | null>(null);
  const [syncedNow, setLastSync] = useState<string | null>(null);
  if (!native) return null;
  // Session restores asynchronously, so read the stored time at render (client-only here).
  const lastSync = syncedNow ?? readLastSync(session?.user.id);

  async function sync() {
    if (!repository || busy) return;
    setBusy(true); setError(null); setResult(null);
    try {
      setStep("Checking Apple Health on this iPhone…");
      const { client } = await loadClient();
      const availability = await client.isAvailable();
      if (!availability.available) throw new Error(availability.reason ?? "Apple Health is not available on this device.");
      setStep("Waiting for your permission in the Health sheet…");
      await client.requestAuthorization({ read: [...APPLE_READ_TYPES] });
      let done = 0;
      const source = new AppleHealthDataSource(client, Date.now, label => setStep(`Reading ${label} (${++done} of ${READ_GROUPS})…`));
      const writer = { saveMetrics: (samples: MetricSample[]) => {
        setStep(`Saving ${samples.length} measurements to your private history…`);
        return repository.saveMetrics(samples);
      } };
      const to = new Date(), from = new Date(to.getTime() - SYNC_DAYS * DAY_MS);
      const { stored } = await ingestHealthData(source, { from, to, metrics: Object.values(Metrics) }, writer);
      setResult({ stored, report: source.lastReport });
      const at = new Date().toISOString();
      setLastSync(at);
      try { if (session) localStorage.setItem(lastSyncKey(session.user.id), at); } catch { /* convenience only */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Apple Health sync failed.");
    } finally { setStep(null); refreshHistory(); setBusy(false); }
  }

  return <section className="card card-body bg-base-100 border border-base-300" aria-labelledby="apple-health-heading">
    <span className="badge badge-soft badge-success"><HeartbeatIcon size={14} aria-hidden="true" /> Your real data</span>
    <h2 id="apple-health-heading">Apple Health</h2>
    <p>Read HRV, resting heart rate, sleep, steps, active energy and workouts from the last {SYNC_DAYS} days. Nothing is written back to Apple Health. Syncing again updates the same records.</p>
    <button className="btn btn-primary" onClick={() => void sync()} disabled={!session || !repository || busy}>{busy ? "Syncing…" : "Connect and sync Apple Health"}</button>
    {step && <p role="status" className="sync-step"><span className="loading loading-spinner loading-sm" aria-hidden="true" /> {step}</p>}
    {lastSync && !busy && <p className="small">Last synced {new Date(lastSync).toLocaleString()}. Each sync re-reads the last {SYNC_DAYS} days; nothing already saved is deleted.</p>}
    {!session && <p className="small">Start a private session first.</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div role="status">
      <p><strong>{result.stored}</strong> measurements saved.</p>
      <ul className="small">{result.report.map(r => <li key={r.metric}>{MetricRegistry[r.metric].label}: {r.status === "records" ? `${r.count} ${describe.records}` : describe[r.status]}</li>)}</ul>
      <p className="small">iOS does not reveal whether reading was declined, so missing data stays unknown rather than zero. Change access in Settings → Health → Data Access.</p>
    </div>}
  </section>;
}
