import { z } from "zod";
import { DailyFeaturesSchema, Features, getLocalDate, MetricSampleSchema, SubjectiveEventSchema, type DailyFeatures, type Feature, type MetricSample, type SubjectiveEvent } from "../domain";
import { builderVersion, featureDates, type FeatureScope } from "./contracts";
type State = DailyFeatures["features"][Feature];
const unknown = (reason: "not_observed" | "not_available" | "ambiguous" | "insufficient_coverage" = "not_observed"): State => ({ status: "unknown", reason });
function known(value: unknown, metricSampleIds: string[], subjectiveEventIds: string[]): State {
 return { status: "known", value, provenance: { metricSampleIds: [...new Set(metricSampleIds)].sort(), subjectiveEventIds: [...new Set(subjectiveEventIds)].sort() } } as State;
}
function median(values: number[]) { const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length/2); return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2; }
function uniqueRecords<T extends { id: string }>(records: T[]): T[] {
 const byId = new Map<string,T>();
 for (const record of records) {
  const prior = byId.get(record.id);
  if (prior && JSON.stringify(prior) !== JSON.stringify(record)) throw new Error("Conflicting canonical record identity");
  byId.set(record.id, record);
 }
 return [...byId.values()].sort((a,b) => a.id.localeCompare(b.id));
}
function metricFeature(samples: MetricSample[], context: MetricSample[]): State {
 if (!samples.length) return unknown();
 const metric = samples[0].metric;
 // Exact interval/value duplicates (including alternate sources) contribute once.
 const groups = new Map<string,MetricSample[]>();
 for (const sample of samples) {
  const key = JSON.stringify([Date.parse(sample.startedAt), Date.parse(sample.endedAt)]);
  const group = groups.get(key) ?? []; group.push(sample); groups.set(key, group);
 }
 if ([...groups.values()].some(g => g.some(s => typeof s.value === "string" ? Date.parse(s.value) !== Date.parse(g[0].value as string) : s.value !== g[0].value))) return unknown("ambiguous");
 const unique = [...groups.values()].map(g => g[0]).sort((a,b) => Date.parse(a.startedAt)-Date.parse(b.startedAt) || a.id.localeCompare(b.id));
 const ids = samples.map(s => s.id);
 // Conflicting descriptions of one session are never silently counted twice.
 const sessions = new Map<string,MetricSample>();
 for (const sample of unique) if (sample.sessionId) {
  const prior = sessions.get(sample.sessionId);
  if (prior && (prior.startedAt !== sample.startedAt || prior.endedAt !== sample.endedAt)) return unknown("ambiguous");
  sessions.set(sample.sessionId,sample);
 }
 if (metric === "hrv" || metric === "resting_hr") return known(median(unique.map(s => s.value as number)), ids, []);
 if(unique.some(s=>Date.parse(s.endedAt)-Date.parse(s.startedAt)>26*3600000)) return unknown("insufficient_coverage");
 // Overlap with another end-day is also a conflict, not a second daily total.
 const selectedIds=new Set(ids);
 for(const outside of context) if(outside.metric===metric&&!selectedIds.has(outside.id)) {
  const a=Date.parse(outside.startedAt),b=Date.parse(outside.endedAt);
  if(unique.some(s=>Date.parse(s.startedAt)<b&&Date.parse(s.endedAt)>a)) return unknown("ambiguous");
 }
 // Totals/boundaries require disjoint intervals; no adapter/source preference.
 for (let i=1;i<unique.length;i++) {
  const previous=unique[i-1], current=unique[i];
  if (Date.parse(previous.endedAt)>Date.parse(current.startedAt)) return unknown("ambiguous");
 }
 if (metric === "sleep_start") return known(unique.reduce((a,s) => Date.parse(s.value as string)<Date.parse(a)?s.value as string:a,unique[0].value as string), ids, []);
 if (metric === "sleep_end") return known(unique.reduce((a,s) => Date.parse(s.value as string)>Date.parse(a)?s.value as string:a,unique[0].value as string), ids, []);
 if (metric === "workout_avg_hr") {
  if (unique.length===1) return known(unique[0].value,ids,[]);
  const minutes=unique.map(s => (Date.parse(s.endedAt)-Date.parse(s.startedAt))/60000);
  if (minutes.some(v => v<=0)) return unknown("insufficient_coverage");
  return known(unique.reduce((sum,s,i)=>sum+(s.value as number)*minutes[i],0)/minutes.reduce((a,b)=>a+b,0),ids,[]);
 }
 return known(unique.reduce((sum,s)=>sum+(s.value as number),0),ids,[]);
}
function subjectiveFeature(events: SubjectiveEvent[]): State {
 if (!events.length) return unknown();
 const type=events[0].type;
 if (type === "energy" || type === "stress" || type === "mood" || type === "soreness" || type === "pain" || type === "workout_rpe") {
  const latest=Math.max(...events.map(e=>Date.parse(e.occurredAt)));
  const chosen=events.filter(e=>Date.parse(e.occurredAt)===latest);
  if (chosen.some(e=>JSON.stringify(e.value)!==JSON.stringify(chosen[0].value))) return unknown("ambiguous");
  return known(chosen[0].value,[],chosen.map(e=>e.id));
 }
 if (type === "caffeine") {
  const coffee=events.filter(e=>e.type === "caffeine");
  if (coffee.some(e=>e.value.consumed) && coffee.some(e=>!e.value.consumed)) return unknown("ambiguous");
  if (coffee.some(e=>e.value.amountMg===null)) return unknown("not_available");
  // The same time/value/source-turn is one report; independent intake reports sum.
  const seen=new Set<string>(); let dose=0;
  for (const e of coffee) { const key=JSON.stringify([e.occurredAt,e.conversationTurnId,e.value]); if(!seen.has(key)) { dose+=e.value.amountMg!; seen.add(key); } }
  return known(dose,[],coffee.map(e=>e.id));
 }
 const values=events.map(e=>e.type === "alcohol" ? e.value.consumed : e.value);
 if (values.some(v=>v!==values[0])) return unknown("ambiguous");
 return known(values[0],[],events.map(e=>e.id));
}
export type DailyInput = { userId: string; timeZone: string; builtAt: string; scope: FeatureScope; metrics: readonly MetricSample[]; events: readonly SubjectiveEvent[] };
/** Pure projection. Source labels affect scope selection, never aggregation math. */
export function buildDailyFeatures(date: string, input: DailyInput): DailyFeatures {
 const context=uniqueRecords(z.array(MetricSampleSchema).parse(input.metrics));
 const metrics=context.filter(s=>getLocalDate(s.endedAt,input.timeZone)===date);
 const events=uniqueRecords(z.array(SubjectiveEventSchema).parse(input.events)).filter(e=>getLocalDate(e.occurredAt,input.timeZone)===date);
 const features: Record<string,State>={};
 for (const key of Object.values(Features)) {
  const samples=metrics.filter(s=>s.metric===key), reports=events.filter(e=>e.type===key);
  features[key]=samples.length ? metricFeature(samples,context) : subjectiveFeature(reports);
 }
 return DailyFeaturesSchema.parse({contractVersion:1,userId:input.userId,date,timeZone:input.timeZone,builtAt:input.builtAt,builderVersion:builderVersion(input.scope),features});
}
export function rebuildDailyFeatures(from: string, to: string, input: DailyInput) { return featureDates(from,to).map(date=>buildDailyFeatures(date,input)); }
