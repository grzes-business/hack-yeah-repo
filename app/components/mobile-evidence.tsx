"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useHealthSession } from "./session";
import { useTalkContext } from "./talk-context";
import { AnalyticsReportSchema, type AnalyticsReport } from "@/lib/analytics/contracts";
import { compareEvidence } from "@/lib/questions/select";
import { LoopViewSchema, type LoopView } from "@/lib/questions/contracts";
import { DailyFeaturesSchema, FeatureRegistry, RelationshipRegistry, addCalendarDays, getLocalDate, type DailyFeatures, type Feature, type Outcome } from "@/lib/domain";
import type { FeatureScope } from "@/lib/features/contracts";
const number=(value:number)=>new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(value);
export function featureValue(day:DailyFeatures,feature:Feature){
 const state=day.features[feature];
 if(state.status==="unknown")return `Unknown · ${state.reason.replaceAll("_"," ")}`;
 if(typeof state.value==="boolean")return state.value?"Reported present":"Reported absent";
 if(typeof state.value==="object")return !state.value.present?"No pain reported":`${state.value.location??"Location unknown"} · ${state.value.intensity===null?"Intensity unknown":`${state.value.intensity}/10`}`;
 if(typeof state.value==="string")return new Intl.DateTimeFormat(undefined,{timeZone:day.timeZone,timeStyle:"short"}).format(new Date(state.value));
 return `${number(state.value)} ${FeatureRegistry[feature].unit==="rating"?"/ 10":FeatureRegistry[feature].unit}`;
}
export function MobileEvidence({insights=false}:{insights?:boolean}){
 const {session,profile}=useHealthSession();
 if(!session||!profile)return <section className="card card-body bg-base-100 border border-base-300 welcome-card"><span className="eyebrow">A little context goes a long way</span><h2>Your personal evidence starts here.</h2><p>Start your private session above, then tell us how you feel. Your observations stay separate from demonstration data.</p><Link className="btn btn-primary action-link" href="/talk">Open Talk →</Link></section>;
 return <EvidenceView key={`${session.user.id}:${profile.time_zone}`} zone={profile.time_zone} insights={insights}/>;
}
function EvidenceView({zone,insights}:{zone:string;insights:boolean}){
 const {session,historyRevision}=useHealthSession(),talk=useTalkContext(),router=useRouter();
 const today=getLocalDate(new Date().toISOString(),zone);
 const [date,setDate]=useState(today),[scope,setScope]=useState<FeatureScope>("personal"),[retry,setRetry]=useState(0);
 const [loaded,setLoaded]=useState<{key:string;report:AnalyticsReport}|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [days,setDays]=useState<DailyFeatures[]>([]),[view,setView]=useState<LoopView|null>(null),[questionBusy,setQuestionBusy]=useState(false);
 const [outcome,setOutcome]=useState<Outcome>("hrv");
 const key=JSON.stringify([date,scope,historyRevision]);
 useEffect(()=>{
  if(!session||!date)return;
  const abort=new AbortController();
  async function load(){
   setBusy(true);setError(null);setDays([]);
   try{
    const headers={Authorization:`Bearer ${session!.access_token}`};
    let response=await fetch(`/api/analytics?${new URLSearchParams({date,scope})}`,{headers,signal:abort.signal});
    let body=await response.json();if(!response.ok)throw new Error(body.error);
    if(body.needsAnalysis){response=await fetch("/api/analytics",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({date,scope}),signal:abort.signal});body=await response.json();if(!response.ok)throw new Error(body.error);}
    const report=AnalyticsReportSchema.parse(body.report);
    if(!abort.signal.aborted)setLoaded({key,report});
    const trend=await fetch(`/api/features?${new URLSearchParams({from:addCalendarDays(date,-6),to:date,scope})}`,{headers,signal:abort.signal});
    if(trend.ok){const history=await trend.json();if(!abort.signal.aborted)setDays(history.rows.map((row:unknown)=>DailyFeaturesSchema.parse(row)));}
   }catch(failure){if(!abort.signal.aborted)setError(failure instanceof Error?failure.message:"Evidence could not load.");}
   finally{if(!abort.signal.aborted)setBusy(false);}
  }
  void load();return()=>abort.abort();
 },[session,date,scope,key,retry]);
 useEffect(()=>{
  if(!session)return;const abort=new AbortController();
  fetch("/api/questions",{headers:{Authorization:`Bearer ${session.access_token}`},signal:abort.signal}).then(async response=>{if(response.ok){const body=LoopViewSchema.parse(await response.json());if(!abort.signal.aborted)setView(body);}}).catch(()=>{});
  return()=>abort.abort();
 },[session,historyRevision,retry]);
 async function investigate(){
  if(!session||questionBusy)return;setQuestionBusy(true);setError(null);
  try{
   const response=await fetch("/api/questions",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"start",revision:view?.revision??0,input:{mode:"investigate",date,outcome,scope,language:"en"}})});
   const body=await response.json();if(!response.ok)throw new Error(body.error);
   const next=LoopViewSchema.parse(body);setView(next);
   if(next.loop?.question){talk.select({mode:"investigate",loopId:next.loop.id,key:next.loop.question.key},next.loop.question.text);router.push("/talk");}
  }catch(failure){setError(failure instanceof Error?failure.message:"Could not select a question.");}
  finally{setQuestionBusy(false);}
 }
 const current=loaded?.key===key?loaded.report:null;
 const sameSelection=view?.loop?.input.date===date&&view.loop.input.scope===scope&&view.loop.input.outcome===outcome;
 const active=sameSelection?view?.loop:null;
 const report=current;
 return <>
  <div className="view-controls"><label>Day<input className="input w-full" aria-label="Selected day" type="date" value={date} max={today} onChange={event=>setDate(event.target.value)}/></label><label>Data source<select className="select w-full" value={scope} onChange={event=>setScope(event.target.value as FeatureScope)}><option value="personal">Personal history</option><option value="demo">Synthetic demo</option></select></label></div>
  {scope==="demo"&&<p className="source-notice"><strong>Synthetic demonstration.</strong> These measurements, reports and answers are fictional, and stay separate from personal history.</p>}
  {busy&&<p role="status">{loaded?"Refreshing evidence… Previous results are not current.":"Preparing your recorded history…"}</p>}
  {error&&<section className="card card-body bg-base-100 border border-base-300" role="alert"><h2>Couldn’t refresh this view.</h2><p>{error}</p><button className="btn btn-primary" onClick={()=>setRetry(v=>v+1)}>Retry</button><p className="small">No new evidence is confirmed here. Previously saved observations remain in History.</p></section>}
  {insights&&view?.loop&&<section className="card card-body bg-base-100 border border-base-300"><p className="eyebrow">Latest investigation · {view.loop.input.scope==="demo"?"synthetic demo":"personal"}</p><h2>{FeatureRegistry[view.loop.input.outcome].label} · {view.loop.input.date}</h2>
   {!view.fresh?<><p role="status">This investigation is stale or needs recovery. Its previous calculations are not current.</p><button className="btn btn-primary" disabled={questionBusy||!!view.loop.pending} onClick={async()=>{if(!session)return;setQuestionBusy(true);try{const response=await fetch("/api/questions",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"refresh",revision:view.revision})});const body=await response.json();if(!response.ok)throw new Error(body.error);setView(LoopViewSchema.parse(body));}catch(failure){setError(failure instanceof Error?failure.message:"Refresh failed.");}finally{setQuestionBusy(false);}}}>Refresh confirmed evidence</button></>:<><p>{view.loop.feedback??"Evidence is current at the server check."}</p><p>{compareEvidence(view.loop.before.bundle,view.loop.current.bundle).historicalChanged?"Historical calculations changed.":"Historical effects and sample sizes are unchanged."}</p><ul>{compareEvidence(view.loop.before.bundle,view.loop.current.bundle).changes.map(change=><li key={`${change.date}:${change.feature}`}>{change.date} · {FeatureRegistry[change.feature].label}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}</li>)}</ul>{view.loop.question&&!view.loop.stopped&&<><p><strong>{view.loop.question.text}</strong></p><Link href="/talk" className="btn btn-primary action-link" onClick={()=>{const loop=view.loop!;talk.select({mode:"investigate",loopId:loop.id,key:loop.question!.key},loop.question!.text);}}>Continue by voice →</Link></>}<details><summary>Evidence statements and limitations</summary><ul>{view.loop.current.explanation.facts.map(fact=><li key={fact.id}>{fact.text}</li>)}</ul><pre>{JSON.stringify(view.loop.current.bundle,null,2)}</pre></details></>}
   {view.loop.pending&&<><p role="alert">An answer is pending. Recover its original saved text; do not record a replacement.</p><button className="btn btn-primary" disabled={questionBusy} onClick={async()=>{if(!session||!view.loop?.pending)return;setQuestionBusy(true);try{const pending=view.loop.pending;const response=await fetch("/api/questions",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({action:"answer",revision:view.revision,answerId:pending.id,text:pending.text})});const body=await response.json();if(!response.ok)throw new Error(body.error);setView(LoopViewSchema.parse(body));}catch(failure){setError(failure instanceof Error?failure.message:"Recovery failed.");}finally{setQuestionBusy(false);}}}>Recover pending answer</button></>}
  </section>}
  {report&&<>
   {!insights&&<><div className="section-heading"><h2>Your day, at a glance</h2><span>{date}</span></div><div className="metric-grid">{(["energy","hrv","sleep_duration","resting_hr"] as const).map(feature=><article key={feature} className={`card card-body bg-base-100 border border-base-300 metric-card ${feature==="energy"?"energy-card":""}`}><p className="eyebrow">{FeatureRegistry[feature].label}</p><strong className={report.currentDay.features[feature].status==="known"?"metric-value":"unknown-value"}>{featureValue(report.currentDay,feature)}</strong><small>{["energy"].includes(feature)?"Voice report":"Wearable measurement"} · {scope==="demo"?"synthetic":"personal"}</small><details><summary>Source details</summary><p>{report.currentDay.features[feature].status==="known"?JSON.stringify(report.currentDay.features[feature].provenance):"No accepted daily value. Missing data is not zero."}</p></details></article>)}</div>
    <section className="card card-body bg-base-100 border border-base-300"><h2>{report.anomalies.length?"A change worth exploring.":"Nothing unusual identified."}</h2>{report.anomalies.length?<ul>{report.anomalies.map(a=><li key={a.metric}>{FeatureRegistry[a.metric].label}: {a.classification.replaceAll("_"," ")} · {a.value} {a.unit}, compared with median {a.baseline} from {a.baselineSampleSize} days.</li>)}</ul>:<p>No unusual value was identified. Sparse or flat history can prevent a comparison; this does not certify that everything is normal.</p>}<Link href="/talk" className="btn btn-primary action-link" onClick={()=>talk.select({mode:"report"})}>Report by voice</Link></section></>}
   <section className="card card-body bg-base-100 border border-base-300 next-action"><h2>Find some context.</h2><p>Choose a recorded outcome. We’ll look for a relevant question you can answer by voice.</p><label>Explore<select className="select w-full" value={outcome} disabled={questionBusy} onChange={e=>setOutcome(e.target.value as Outcome)}><option value="hrv">HRV</option><option value="energy">Energy</option><option value="sleep_duration">Sleep duration</option></select></label><button className="btn btn-primary" disabled={questionBusy||busy} onClick={()=>void investigate()}>{questionBusy?"Looking at evidence…":"Explore by voice"}</button>
    {active&&view?.fresh&&!active.question&&<p>{active.stopped?"Questions are stopped for this investigation.":"No useful answerable question remains for this selection. Wearable gaps cannot be filled by voice."}</p>}
   </section>
   <section className="card card-body bg-base-100 border border-base-300 trend-card"><div className="section-heading"><h2>Reported energy</h2><span>Last 7 days · 0-10</span></div><div className="energy-trend" role="img" aria-label={days.map(day=>`${day.date}: ${featureValue(day,"energy")}`).join("; ")||"No current daily energy history"}>{Array.from({length:7},(_,index)=>{const dayDate=addCalendarDays(date,index-6),day=days.find(d=>d.date===dayDate),state=day?.features.energy;return <div className="trend-day" key={dayDate}><div className="trend-track">{state?.status==="known"?<span style={{height:`${state.value*10}%`,minHeight:state.value===0?"0":"3px"}}/>:<span className="trend-gap">?</span>}</div><small>{dayDate.slice(8)}</small></div>;})}</div><details><summary>Daily values and gaps</summary><ul>{days.map(day=><li key={day.date}>{day.date}: {featureValue(day,"energy")}</li>)}</ul><p>Unknown days stay gaps. Bars show recorded daily ratings, not a readiness score.</p></details></section>
   {insights&&<>
    <section className="card card-body bg-base-100 border border-base-300"><h2>Compared with your history</h2>{report.baselines.map(b=><details key={b.feature}><summary>{FeatureRegistry[b.feature].label} · {b.status==="available"?`median ${b.median===null?"undefined":number(b.median)} ${FeatureRegistry[b.feature].unit}`:"Insufficient history"}</summary><p>Current: {b.currentValue===null?"Unknown":number(b.currentValue)}. Historical days: {b.sampleSize}. Period: {b.period.from} to {b.period.to}.</p><ul>{b.limitations.map(l=><li key={l}>{l}</li>)}</ul></details>)}</section>
    <section className="relationships"><div className="section-heading"><h2>Patterns in your history</h2><span>Association ≠ cause</span></div>{report.relationships.map(result=>{const definition=RelationshipRegistry[result.relationshipId];return <article className="card card-body bg-base-100 border border-base-300" key={result.relationshipId}><p className="eyebrow">{definition.lagDays?"Previous day → next day":"Same day"}</p><h2>{FeatureRegistry[definition.factor].label} → {FeatureRegistry[definition.outcome].label}</h2><span className="badge">{result.evidence.toLowerCase().replaceAll("_"," ")}</span><p>{result.sampleSize} eligible pairs · {result.period.from} to {result.period.to}</p>{result.effect?.kind==="spearman"&&<p>Rank correlation: <strong>{number(result.effect.rho)}</strong></p>}{result.effect?.kind==="exposure"&&<p>After exposure: {result.effect.exposedCount} days, median {number(result.effect.exposedMedian)} {result.effect.unit}. After reported absence: {result.effect.controlCount} days, median {number(result.effect.controlMedian)} {result.effect.unit}. Difference: {number(result.effect.medianDifference)} {result.effect.unit}.</p>}{result.status==="insufficient_data"&&<p>There is not enough eligible data or variation to evaluate this relationship. That does not establish the absence of an association.</p>}<details><summary>Method, dates and limitations</summary><p>Method: {definition.method}. Lag: {definition.lagDays} day(s).</p><p>{result.pairedOutcomeDates.join(", ")||"No eligible dates."}</p><ul>{result.limitations.map(l=><li key={l}>{l}</li>)}</ul></details></article>;})}</section>
   </>}
   <details className="card card-body bg-base-100 border border-base-300"><summary>Daily observations and provenance</summary><p>Derived values for {date} · {zone} · {scope}.</p><ul>{Object.keys(report.currentDay.features).map(key=><li key={key}><strong>{FeatureRegistry[key as Feature].label}:</strong> {featureValue(report.currentDay,key as Feature)}</li>)}</ul><details><summary>Validated source payload</summary><pre>{JSON.stringify(report.currentDay,null,2)}</pre></details></details>
   <p className="small evidence-footnote">Computed {new Date(report.computedAt).toLocaleString()} · {zone}. Historical windows exclude this day. Associations cannot establish a cause.</p>
  </>}
 </>;
}
