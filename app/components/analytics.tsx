"use client";
import { useEffect, useState } from "react";
import { useHealthSession } from "./session";
import { getLocalDate, FeatureRegistry, RelationshipRegistry } from "@/lib/domain";
import { AnalyticsReportSchema, type AnalyticsReport } from "@/lib/analytics/contracts";
import type { FeatureScope } from "@/lib/features/contracts";
const number=(value:number|null)=>value===null?"Not defined":new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(value);
const label=(value:string)=>value.toLowerCase().replaceAll("_"," ");
export function AnalyticsPanel(){
 const {session,profile}=useHealthSession();
 if(!session||!profile)return <section className="card card-body bg-base-100 border border-base-300"><h2>Start a private demo session</h2><p>Your evidence uses only your session’s recorded history.</p></section>;
 return <AnalyticsInspector key={`${session.user.id}:${profile.time_zone}`} zone={profile.time_zone}/>;
}
function AnalyticsInspector({zone}:{zone:string}){
 const {session,historyRevision,refreshHistory}=useHealthSession();
 const [date,setDate]=useState(()=>getLocalDate(new Date().toISOString(),zone));
 const [scope,setScope]=useState<FeatureScope>("personal"),[busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState<{key:string;report:AnalyticsReport|null;error:string|null}|null>(null);
 const key=JSON.stringify([date,scope,historyRevision]);
 useEffect(()=>{
  if(!session||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const abort=new AbortController();
  fetch(`/api/analytics?${new URLSearchParams({date,scope})}`,{headers:{Authorization:`Bearer ${session.access_token}`},signal:abort.signal}).then(async response=>{
   const body=await response.json();if(!response.ok)throw new Error(body.error||"Analysis could not load.");
   if(!abort.signal.aborted)setLoaded({key,report:body.needsAnalysis?null:AnalyticsReportSchema.parse(body.report),error:null});
  }).catch(error=>{if(!abort.signal.aborted)setLoaded({key,report:null,error:error instanceof Error?error.message:"Analysis could not load."});});
  return()=>abort.abort();
 },[session,date,scope,key]);
 async function analyze(){
  if(!session||busy)return;
  setBusy(true);setLoaded(null);
  try{
   const response=await fetch("/api/analytics",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({date,scope})});
   const body=await response.json();if(!response.ok)throw new Error(body.error||"Analysis could not complete.");
   // Notify other views; the generation remains unchanged when only derived rows are rebuilt.
   refreshHistory();
  }catch(error){setLoaded({key,report:null,error:error instanceof Error?error.message:"Analysis could not complete."});}
  finally{setBusy(false);}
 }
 const current=loaded?.key===key?loaded:null,report=current?.report;
 return <>
  <section className="card card-body bg-base-100 border border-base-300"><h2>Analyze recorded history</h2><p>Compare the selected day with your history and evaluate four predefined relationships. Analysis rebuilds the required daily observations automatically.</p>
   <div className="voice-actions"><label>Selected day<input className="input w-full" type="date" value={date} disabled={busy} onChange={event=>setDate(event.target.value)}/></label><label>History<select className="select w-full" value={scope} disabled={busy} onChange={event=>setScope(event.target.value as FeatureScope)}><option value="personal">Personal observations</option><option value="demo">Synthetic demonstration</option></select></label><button className="btn btn-primary" disabled={busy||!date} onClick={()=>void analyze()}>{busy?"Analyzing…":"Analyze history"}</button></div>
   <p className="small">{zone} · 28-day baselines · 42-day associations · selected day excluded from both historical windows.</p>
   {scope==="demo"&&<p><strong>Synthetic demonstration data. These results do not describe your health.</strong> Load sample history on Today first.</p>}
   {current?.error&&<p role="alert">{current.error}</p>}
   {!busy&&current&&!current.error&&!report&&<p>No current analysis for this day. Choose Analyze history to build it.</p>}
   {!current&&!busy&&<p role="status">Loading current analysis…</p>}
  </section>
  {report&&<>
   <section className="card card-body bg-base-100 border border-base-300"><h2>Compared with your baseline</h2><p>{report.date}: {report.anomalies.length?`${report.anomalies.length} recorded measures meet the unusual-value criteria.`:"No unusual value was identified under the current rules. Missing data or a flat baseline can prevent classification."}</p>
    <ul>{report.baselines.map(baseline=><li key={baseline.feature}><strong>{FeatureRegistry[baseline.feature].label}</strong>: current {number(baseline.currentValue)} · historical median {number(baseline.median)} {FeatureRegistry[baseline.feature].unit} · {baseline.sampleSize} known historical days. {report.anomalies.find(a=>a.metric===baseline.feature)?.classification.replaceAll("_"," ")} {baseline.limitations.join(" ")}</li>)}</ul>
   </section>
   <section className="card card-body bg-base-100 border border-base-300"><h2>Relationships in recorded history</h2>{report.relationships.map(result=>{
    const definition=RelationshipRegistry[result.relationshipId];
    return <article key={result.relationshipId}><h3>{FeatureRegistry[definition.factor].label} → {FeatureRegistry[definition.outcome].label}</h3><p><strong>{label(result.evidence)}</strong> · {result.sampleSize} eligible pairs · {result.period.from} to {result.period.to} · {definition.lagDays?"factor on the previous day":"same-day factor"}</p>
     {result.effect?.kind==="spearman"&&<p>Rank correlation: {number(result.effect.rho)}. A positive value means the recorded variables tended to rise together; a negative value means they tended to move in opposite directions.</p>}
     {result.effect?.kind==="exposure"&&<p>Exposed: {result.effect.exposedCount} days, median {number(result.effect.exposedMedian)} {result.effect.unit}. Control: {result.effect.controlCount} days, median {number(result.effect.controlMedian)} {result.effect.unit}. Difference: {number(result.effect.medianDifference)} {result.effect.unit}{result.effect.relativeDifference!==null?` (${number(result.effect.relativeDifference*100)}%)`: "; percentage difference is undefined"}.</p>}
     <details><summary>Dates and limitations</summary><p>{result.pairedOutcomeDates.join(", ")||"No eligible pairs."}</p><ul>{result.limitations.map(line=><li key={line}>{line}</li>)}</ul></details>
    </article>;
   })}</section>
   <section className="card card-body bg-base-100 border border-base-300"><h2>Interpretation limits</h2><ul>{report.limitations.map(line=><li key={line}>{line}</li>)}</ul><p className="small">Policy: {report.analysisVersion}. Generation: {report.inputGeneration}. Updates to observations invalidate these results.</p></section>
  </>}
 </>;
}
