"use client";
import Link from "next/link";
import { formatValue } from "@/lib/format";
import { cached, historyKey } from "@/app/components/data-cache";
import { formatObservation } from "@/lib/capture/display";
import { HistoryReset } from "../../components/history-reset";
import { useEffect, useState } from "react";
import { MetricRegistry, SubjectiveEventRegistry } from "@/lib/domain";

import { useHealthSession } from "../../components/session";
type Item = { key: string; label: string; at: string; value: string; source: string; dateOnly?: boolean; timeZone?: string; provenance?: [string, string][]; note?: string };
export default function Timeline() {
 const { session, repository, profile, historyRevision } = useHealthSession();
 const [state, setState] = useState<{ owner: string; items: Item[]; error: boolean } | null>(null);
 const [filter,setFilter]=useState("all");
 const [revision, setRevision] = useState(0);
 const id = session?.user.id;
 useEffect(() => {
  if (!id || !repository) return;
  let active = true;
  cached(historyKey(id, historyRevision), () => repository.listObservations()).then(data => {
   const items = [...data.metrics.map(v => ({ key: `metric:${v.id}`, label: MetricRegistry[v.metric].label, at: v.endedAt, value: typeof v.value === "number" ? formatValue(v.metric, v.value) : new Date(v.value).toLocaleTimeString(undefined, { timeZone: profile?.time_zone, timeStyle: "short" }), source: v.source.type === "mock" ? "Synthetic demo sample" : "Apple Health", provenance: [["Record ID", v.id], ["Source ID", v.source.externalId], ["Interval", `${v.startedAt} → ${v.endedAt}`]] as [string, string][], note: undefined as string | undefined })), ...data.events.map(v => ({ key: `event:${v.id}`, label: SubjectiveEventRegistry[v.type].label, at: v.occurredAt, dateOnly: false, timeZone: v.timeZone, value: formatObservation(v), provenance: [["Report ID", v.id], ["Source turn", v.conversationTurnId], ["Captured", v.capturedAt], ["Time zone", v.timeZone]] as [string, string][], note: "Stored occurrence time can be representative if only a date was reported.", source: v.id.startsWith("demo:") ? "Synthetic conversation fixture" : v.id.startsWith("sample:") ? "Sample report (fictional)" : "Voice report" }))].sort((a,b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
   if (active) setState({ owner: id, items, error: false });
  }).catch(() => { if (active) setState({ owner: id, items: [], error: true }); });
  return () => { active = false; };
 }, [id, repository, revision, historyRevision, profile?.time_zone]);
 const current = state?.owner === id ? state : null;
 return <><header className="header"><h1>History</h1><p className="lede">Your measurements and reports, with their sources.</p></header><section className="card card-body bg-base-100 border border-base-300"><div className="filter-row"><label>Show<select className="select w-full" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All sources</option><option value="personal">Personal only</option><option value="wearable">Wearable measurements</option><option value="voice">Voice reports</option><option value="sample">Sample reports</option><option value="demo">Synthetic demo</option></select></label></div>
 {!id ? <><h2>No session yet</h2><p>Start a demo session to open your private timeline.</p></> : !current ? <p role="status">Loading observations…</p> : current.error ? <><p role="alert">Could not load observations. Check the database setup and retry.</p><button className="btn btn-primary" onClick={() => setRevision(v => v+1)}>Retry</button></> : current.items.length === 0 ? <><h2>Your timeline is empty</h2><p>There are no saved observations in this session yet. Load sample history from Today to explore this view.</p></> : <><p>Showing up to 500 records from each source.</p><ul className="observations">{current.items.filter(item=>filter==="all"||filter==="personal"&&!/demo|synthetic/i.test(item.source)||filter==="demo"&&/demo|synthetic/i.test(item.source)||filter==="sample"&&/sample report/i.test(item.source)||filter==="wearable"&&item.key.startsWith("metric:")||filter==="voice"&&item.key.startsWith("event:")).map(item => <li key={item.key}><strong>{item.label}</strong><span>{item.value}</span><small>{new Date(item.at).toLocaleString(undefined, { timeZone: item.timeZone ?? profile?.time_zone ?? "UTC", ...(item.dateOnly ? {dateStyle:"medium" as const} : {}) })} · {item.source}</small>{item.provenance&&<details><summary>Source details</summary><dl className="provenance-list">{item.provenance.map(([label,value])=><div key={label}><dt>{label}</dt><dd><code>{value}</code></dd></div>)}</dl>{item.note&&<p className="small">{item.note}</p>}</details>}</li>)}</ul></>}
 </section><section className="card card-body bg-base-100 border border-base-300"><h2>Need to correct a report?</h2><p>Open Talk, expand saved reports, select the original report and speak your correction. Wearable measurements cannot be changed by voice.</p><Link className="btn btn-primary action-link" href="/talk">Correct by voice →</Link></section><details className="card card-body bg-base-100 border border-base-300"><summary>Clear history</summary><HistoryReset /></details></>;
}
