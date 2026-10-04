"use client";
import { ActiveQuestions } from "./active-questions";
import { useEffect, useRef, useState } from "react";
import { getLocalDate, type Outcome } from "@/lib/domain";
import { InvestigationResultSchema, type InvestigationResult } from "@/lib/investigation/contracts";
import { useHealthSession } from "./session";
import type { FeatureScope } from "@/lib/features/contracts";
export function InvestigationPanel(){
 const {session,profile}=useHealthSession();if(!session||!profile)return null;
 return <InvestigationInspector key={`${session.user.id}:${profile.time_zone}`} zone={profile.time_zone}/>;
}
function InvestigationInspector({zone}:{zone:string}){
 const {session,historyRevision,refreshHistory}=useHealthSession();
 const [date,setDate]=useState(()=>getLocalDate(new Date().toISOString(),zone)),[outcome,setOutcome]=useState<Outcome>("hrv"),[scope,setScope]=useState<FeatureScope>("personal");
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState<{key:string;revision:number;result:InvestigationResult}|null>(null);
 const request=useRef<AbortController|null>(null),revision=useRef(historyRevision);
 useEffect(()=>{revision.current=historyRevision;},[historyRevision]);
 useEffect(()=>()=>request.current?.abort(),[]);
 const key=JSON.stringify([date,outcome,scope]),current=saved?.key===key&&saved.revision===historyRevision?saved.result:null;
 async function investigate(){
  if(!session||busy)return;
  const startedRevision=historyRevision,abort=new AbortController();request.current=abort;setBusy(true);setError(null);setSaved(null);
  try{
   const response=await fetch("/api/investigate",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({mode:"investigate",date,outcome,scope,language:"en"}),signal:abort.signal});
   const body=await response.json();if(!response.ok)throw new Error(body.error||"Investigation could not complete.");
   if(abort.signal.aborted)return;
   const result=InvestigationResultSchema.parse(body);
   if(revision.current!==startedRevision)throw new Error("History changed while investigating. Run it again to inspect current evidence.");
   refreshHistory();setSaved({key,revision:startedRevision+1,result});
  }catch(failure){if(!abort.signal.aborted)setError(failure instanceof Error?failure.message:"Investigation could not complete.");}
  finally{if(!abort.signal.aborted)setBusy(false);}
 }
 return <><section className="card card-body bg-base-100 border border-base-300" aria-label="Outcome investigation"><h2>Investigate an outcome</h2><p>Understand the recorded outcome, historical associations and the context that is still unknown.</p>
  <div className="voice-actions"><label>Outcome<select className="select w-full" value={outcome} disabled={busy} onChange={event=>setOutcome(event.target.value as Outcome)}><option value="hrv">HRV</option><option value="energy">Energy</option><option value="sleep_duration">Sleep duration</option></select></label><label>Day<input className="input w-full" type="date" value={date} disabled={busy} onChange={event=>setDate(event.target.value)}/></label><label>History<select className="select w-full" value={scope} disabled={busy} onChange={event=>setScope(event.target.value as FeatureScope)}><option value="personal">Personal observations</option><option value="demo">Synthetic demonstration</option></select></label><button className="btn btn-primary" disabled={busy||!date} onClick={()=>void investigate()}>{busy?"Investigating…":"Investigate"}</button></div>
  {scope==="demo"&&<p><strong>Synthetic demonstration. Load sample history on Today and use a date within that history.</strong></p>}
  {error&&<p role="alert">{error}</p>}
  {saved&&!current&&!busy&&<p>The selected date, outcome or history changed. Run a fresh investigation.</p>}
  {current&&<><h3>What the evidence says</h3><ul>{current.explanation.facts.map(fact=><li key={fact.id}>{fact.text}</li>)}</ul>
   {current.explanation.source==="deterministic_fallback"&&<p className="small">The explanation provider was unavailable or its response was invalid. These statements are rendered directly from the validated evidence.</p>}
   <details><summary>Structured evidence and provenance</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(current.bundle,null,2)}</pre></details>
  </>}
 </section><ActiveQuestions input={{mode:"investigate",date,outcome,scope,language:"en"}}/></>;
}
