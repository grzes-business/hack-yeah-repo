"use client";
import { useEffect, useState } from "react";
import { useHealthSession } from "./session";
import { addCalendarDays, DailyFeaturesSchema, FeatureRegistry, getLocalDate, type DailyFeatures } from "@/lib/domain";
import { FeatureRangeSchema, type FeatureScope } from "@/lib/features/contracts";
export function DailyFeaturePanel(){
 const {session,profile}=useHealthSession();
 if(!session||!profile)return null;
 return <DailyFeatureInspector key={`${session.user.id}:${profile.time_zone}`} zone={profile.time_zone}/>;
}
function DailyFeatureInspector({zone}:{zone:string}){
 const {session,historyRevision,refreshHistory}=useHealthSession();
 const [to,setTo]=useState(()=>getLocalDate(new Date().toISOString(),zone));
 const [from,setFrom]=useState(()=>addCalendarDays(to,-6));
 const [scope,setScope]=useState<FeatureScope>("personal");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<string|null>(null);
 const [loaded,setLoaded]=useState<{key:string;rows:DailyFeatures[];missing:string[];error:string|null}|null>(null);
 const key=JSON.stringify([from,to,scope,historyRevision]);
 const valid=FeatureRangeSchema.safeParse({from,to,scope}).success;
 useEffect(()=>{
  if(!session||!valid)return;
  const abort=new AbortController();
  fetch(`/api/features?${new URLSearchParams({from,to,scope})}`,{headers:{Authorization:`Bearer ${session.access_token}`},signal:abort.signal}).then(async response=>{
   const data=await response.json();if(!response.ok)throw new Error(data.error||"Daily rows could not load.");
   if(!abort.signal.aborted)setLoaded({key,rows:data.rows.map((r:unknown)=>DailyFeaturesSchema.parse(r)),missing:data.missingDates,error:null});
  }).catch(error=>{if(!abort.signal.aborted)setLoaded({key,rows:[],missing:[],error:error instanceof Error?error.message:"Daily rows could not load."});});
  return()=>abort.abort();
 },[session,from,to,scope,key,valid]);
 async function rebuild(){
  if(!session||!valid||busy)return;
  setBusy(true);setNotice(null);
  try{
   const response=await fetch("/api/features",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({from,to,scope})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||"Daily rebuilding failed.");
   setNotice(`${data.rows.length} daily rows confirmed. Any later observation change requires another rebuild.`);refreshHistory();
  }catch(error){setNotice(error instanceof Error?error.message:"Daily rebuilding failed. Retry.");}
  finally{setBusy(false);}
 }
 const current=loaded?.key===key?loaded:null;
 return <section className="card" aria-label="Daily observations">
  <h2>Daily observations</h2>
  <p>Combine recorded observations into daily values with source references. These are recorded summaries, not evidence of a cause or a complete day of activity.</p>
  <div className="voice-actions">
   <label>From<input type="date" value={from} disabled={busy} onChange={e=>setFrom(e.target.value)}/></label>
   <label>Through<input type="date" value={to} disabled={busy} onChange={e=>setTo(e.target.value)}/></label>
   <label>History<select value={scope} disabled={busy} onChange={e=>setScope(e.target.value as FeatureScope)}><option value="personal">Personal observations</option><option value="demo">Synthetic demo only</option></select></label>
   <button disabled={!valid||busy} onClick={()=>void rebuild()}>{busy?"Rebuilding…":"Rebuild daily observations"}</button>
  </div>
  {!valid&&<p role="alert">Choose an inclusive range of up to 60 days.</p>}
  {notice&&<p role="status">{notice}</p>}
  {valid&&!current&&<p role="status">Loading current daily rows…</p>}
  {current?.error&&<p role="alert">{current.error}</p>}
  {current&&!current.error&&<>
   <p className="small">{zone} · {scope==="demo"?"Synthetic data":"Personal data"}. {current.missing.length} days need building or rebuilding.</p>
   {current.rows.map(row=><details key={row.date}><summary>{row.date} · {Object.values(row.features).filter(f=>f.status==="known").length} of 19 features known</summary><ul>{Object.entries(row.features).map(([name,state])=><li key={name}><strong>{FeatureRegistry[name as keyof typeof FeatureRegistry].label}:</strong> {state.status==="unknown"?`Unknown (${state.reason.replaceAll("_"," ")})`:<>{typeof state.value==="object"?JSON.stringify(state.value):String(state.value)} <span className="small">{FeatureRegistry[name as keyof typeof FeatureRegistry].unit} · sources: {[...state.provenance.metricSampleIds,...state.provenance.subjectiveEventIds].join(", ")}</span></>}</li>)}</ul></details>)}
  </>}
 </section>;
}
