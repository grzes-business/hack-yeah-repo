"use client";
import { useEffect, useRef, useState } from "react";
import { LoopViewSchema, type LoopView, type QuestionAction } from "@/lib/questions/contracts";
import { compareEvidence } from "@/lib/questions/select";
import type { InvestigationInput } from "@/lib/investigation/contracts";
import Link from "next/link";
import { useTalkContext } from "./talk-context";
import { useHealthSession } from "./session";
export function ActiveQuestions({input}:{input:InvestigationInput}){
 const {session,historyRevision,refreshHistory}=useHealthSession();
 const talk=useTalkContext();
 const [view,setView]=useState<LoopView|null>(null),[,setText]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const request=useRef<AbortController|null>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;request.current?.abort();};},[]);
 useEffect(()=>{
  if(!session)return;let active=true;
  fetch("/api/questions",{headers:{Authorization:`Bearer ${session.access_token}`}}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error);if(active)setView(LoopViewSchema.parse(body));}).catch(failure=>{if(active)setError(failure.message);});
  return ()=>{active=false;};
 },[session,historyRevision]);
 async function act(action:QuestionAction){
  if(!session||busy)return;setBusy(true);setError(null);request.current=new AbortController();
  try{
   const response=await fetch("/api/questions",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(action),signal:request.current.signal});
   const body=await response.json();if(!response.ok)throw new Error(body.error);
   if(!mounted.current)return;const next=LoopViewSchema.parse(body);setView(next);if(!next.loop?.pending)setText("");refreshHistory();
  }catch(failure){
   if(mounted.current){setError(failure instanceof Error?failure.message:"Question processing failed.");
    // Lost responses recover the committed state before the user can resend an answer.
    try{const response=await fetch("/api/questions",{headers:{Authorization:`Bearer ${session.access_token}`}});if(response.ok)setView(LoopViewSchema.parse(await response.json()));}catch{/* Keep the error and disable unsafe retries until reload. */}
   }
  }finally{if(mounted.current)setBusy(false);}
 }
 if(!session)return null;
 const loop=view?.loop,question=loop?.question,revision=view?.revision??0;
 const comparison=loop&&loop.before.bundle.dailyFeatures.timeZone===loop.current.bundle.dailyFeatures.timeZone?compareEvidence(loop.before.bundle,loop.current.bundle):null;
 return <section className="card card-body bg-base-100 border border-base-300" aria-label="Missing evidence questions"><h2>Fill in missing context</h2>
  <p>The app selects one registered, answerable gap. Every answer is validated before evidence is refreshed.</p>
  <button className="btn btn-primary" disabled={busy||!view||!!loop?.pending} onClick={()=>void act({action:"start",revision,input})}>Ask about missing context for selected outcome</button>
  {error&&<p role="alert">{error}</p>}
  {loop&&<><p><strong>{loop.input.scope==="demo"?"Synthetic demonstration":"Personal evidence"}</strong> · {loop.input.outcome} · {loop.input.date} · {loop.current.bundle.dailyFeatures.timeZone}</p>
   {loop.input.scope==="demo"&&<p>Answers here are simulated demo observations. They never become personal reports.</p>}
   {!view?.fresh&&<p role="status">This snapshot needs a refresh. A previously confirmed answer will not be recorded again.</p>}
   {loop.feedback&&<p role="status">{loop.feedback}</p>}
   {question&&!loop.stopped&&<><h3>One question</h3><p>{question.text}</p><p className="small">Reply with yes/no, an explicit rating, or a complete report. Explicit dates and other observations take precedence. “I don’t know” leaves the value unknown. You can also answer this active question in Talk.</p>
    <Link className="btn btn-primary action-link" href="/talk" onClick={()=>talk.select({mode:"investigate",loopId:loop.id,key:question.key},question.text)}>Answer by voice →</Link>
    <div className="voice-actions">
     {loop.pending&&<button className="btn btn-primary" disabled={busy} onClick={()=>void act({action:"answer",revision,answerId:loop.pending!.id,text:loop.pending!.text})}>Retry pending answer</button>}
     <button className="btn btn-primary" disabled={busy} onClick={()=>void act({action:"skip",revision})}>Skip this question</button><button className="btn btn-primary" disabled={busy} onClick={()=>void act({action:"stop",revision})}>Stop questions</button></div></>}
   {!question&&view?.fresh&&<p>{loop.stopped?"Questioning stopped.":"No useful answerable question remains. Known, skipped, answered, unavailable and ambiguous context is excluded; wearable gaps cannot be answered by guessing."}</p>}
   <button className="btn btn-primary" disabled={busy||!!loop.pending} onClick={()=>void act({action:"refresh",revision})}>Refresh evidence without recording again</button>
   {view?.fresh&&<><h3>Before / after</h3><p>Generations: {loop.before.inputGeneration} → {loop.current.inputGeneration}. The original investigation is a historical snapshot; the refreshed evidence is current at the server check.</p>
    {comparison&&<><p>{comparison.historicalChanged?"Historical calculations changed. Compare the counts and effects below.":"Historical association strength, effects and sample sizes are unchanged. Filling current context does not establish a cause."}</p>
     {comparison.changes.length?<ul>{comparison.changes.map(change=><li key={`${change.feature}:${change.date}`}>{change.date} · {change.feature}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}</li>)}</ul>:<p>No daily value changed.</p>}</>}
    <details><summary>Historical comparisons</summary><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify({before:loop.before.bundle.relationships,after:loop.current.bundle.relationships},null,2)}</pre></details>
    <h3>Refreshed evidence</h3><ul>{loop.current.explanation.facts.map(fact=><li key={fact.id}>{fact.text}</li>)}</ul></>}
  </>}
 </section>;
}
