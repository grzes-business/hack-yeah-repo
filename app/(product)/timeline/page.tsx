"use client";
import { HistoryReset } from "../../components/history-reset";
import { useEffect, useState } from "react";
import { MetricRegistry, SubjectiveEventRegistry, type SubjectiveEvent } from "@/lib/domain";
import { DEMO_PREFIX } from "@/lib/demo/scenario";
import { useHealthSession } from "../../components/session";
type Item = { key: string; label: string; at: string; value: string; source: string; dateOnly?: boolean; timeZone?: string };
function eventValue(event: SubjectiveEvent): string {
 switch (event.type) {
  case "energy": case "stress": case "mood": case "soreness": case "workout_rpe": return `${event.value} / 10`;
  case "late_meal": case "illness": return event.value ? "Reported" : "Reported absent";
  case "alcohol": return !event.value.consumed ? "No alcohol reported" : event.value.quantity === null ? "Alcohol reported; amount unknown" : `${event.value.quantity} reported drinks`;
  case "caffeine": return !event.value.consumed ? "No caffeine reported" : event.value.amountMg === null ? "Caffeine reported; amount unknown" : `${event.value.amountMg} mg`;
  case "pain": return !event.value.present ? "No pain reported" : `${event.value.location ?? "Location unknown"} · ${event.value.intensity === null ? "Intensity unknown" : `${event.value.intensity} / 10`}`;
 }
}
export default function Timeline() {
 const { session, repository, profile, historyRevision } = useHealthSession();
 const [state, setState] = useState<{ owner: string; items: Item[]; error: boolean } | null>(null);
 const [revision, setRevision] = useState(0);
 const id = session?.user.id;
 useEffect(() => {
  if (!id || !repository) return;
  let active = true;
  repository.listObservations().then(data => {
   const items = [...data.metrics.map(v => ({ key: `metric:${v.id}`, label: MetricRegistry[v.metric].label, at: v.endedAt, value: `${v.value} ${v.unit}`, source: v.source.type === "mock" ? "Demo sample" : "Apple Health" })), ...data.events.map(v => ({ key: `event:${v.id}`, label: SubjectiveEventRegistry[v.type].label, at: v.occurredAt, dateOnly: v.id.startsWith("capture:v1:"), timeZone: v.timeZone, value: eventValue(v), source: v.id.startsWith(DEMO_PREFIX) && v.conversationTurnId.startsWith(DEMO_PREFIX) ? "Synthetic conversation fixture" : "Conversation observation" }))].sort((a,b) => Date.parse(b.at) - Date.parse(a.at) || a.key.localeCompare(b.key));
   if (active) setState({ owner: id, items, error: false });
  }).catch(() => { if (active) setState({ owner: id, items: [], error: true }); });
  return () => { active = false; };
 }, [id, repository, revision, historyRevision]);
 const current = state?.owner === id ? state : null;
 return <><header className="header"><p className="eyebrow">Your observations</p><h1>Timeline</h1><p className="lede">Wearable measurements and conversational context, with their origins preserved.</p></header><section className="card">
 {!id ? <><h2>No session yet</h2><p>Start a demo session to open your private timeline.</p></> : !current ? <p role="status">Loading observations…</p> : current.error ? <><p role="alert">Could not load observations. Check the database setup and retry.</p><button onClick={() => setRevision(v => v+1)}>Retry</button></> : current.items.length === 0 ? <><h2>Your timeline is empty</h2><p>There are no saved observations in this session yet. Load sample history from Today to explore this view.</p></> : <><p>Showing up to 500 records from each source.</p><ul className="observations">{current.items.map(item => <li key={item.key}><strong>{item.label}</strong><span>{item.value}</span><small>{new Date(item.at).toLocaleString(undefined, { timeZone: item.timeZone ?? profile?.time_zone ?? "UTC", ...(item.dateOnly ? {dateStyle:"medium" as const} : {}) })} · {item.source}</small></li>)}</ul></>}
 </section><HistoryReset /></>;
}
