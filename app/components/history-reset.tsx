"use client";
import { useState } from "react";
import { useHealthSession } from "./session";
export function HistoryReset(){
 const {session}=useHealthSession();
 return session?<ResetControl key={session.user.id}/>:null;
}
function ResetControl(){
 const {session}=useHealthSession();
 const [confirming,setConfirming]=useState(false);
 const [confirmation,setConfirmation]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 async function clear(){
  if(!session||busy||confirmation!=="CLEAR MY HISTORY")return;
  setBusy(true);setError(null);
  try{
   const response=await fetch("/api/history/reset",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({confirmation})});
   const body=await response.json();if(!response.ok||body.cleared!==true)throw new Error(body.error||"History clearing was not confirmed.");
   try{
    sessionStorage.removeItem(`personal-evidence:voice-pending:${session.user.id}`);
    sessionStorage.removeItem(`personal-evidence:voice-target:${session.user.id}`);
   }catch{/* Server tombstones also reject restored old conversations. */}
   // Remount every view so old in-memory history cannot remain on screen.
   window.location.reload();
  }catch(error){setError(error instanceof Error?error.message:"History clearing failed. Retry.");setBusy(false);}
 }
 return <section className="card card-body bg-base-100 border border-base-300" aria-labelledby="history-reset-heading">
  <h2 id="history-reset-heading">Start with a clean slate</h2>
  <p>Clear this account’s saved observations and history. Your profile and signed-in session stay available.</p>
  {!confirming?<button className="btn btn-soft" onClick={()=>setConfirming(true)}>Clear all history…</button>:<form onSubmit={e=>{e.preventDefault();void clear();}}>
   <p id="history-reset-warning">This permanently deletes all your personal and demo observations, wearable samples, conversations and transcripts, capture revisions, check-in progress, daily summaries and analysis results. This cannot be undone. Stop voice and sample loading in other tabs before continuing.</p>
   <label htmlFor="history-reset-confirmation">Type CLEAR MY HISTORY to confirm</label>
   <input className="input w-full" id="history-reset-confirmation" value={confirmation} disabled={busy} autoComplete="off" aria-describedby="history-reset-warning" onChange={e=>setConfirmation(e.target.value)}/>
   <div className="button-row"><button className="btn btn-error" type="submit" disabled={busy||confirmation!=="CLEAR MY HISTORY"}>{busy?"Clearing…":"Permanently clear my history"}</button><button type="button" className="btn btn-soft" disabled={busy} onClick={()=>{setConfirming(false);setConfirmation("");setError(null);}}>Cancel</button></div>
  </form>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
