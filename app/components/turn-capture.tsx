"use client";
import { useEffect, useRef, useState } from "react";
import { useHealthSession } from "./session";
import { CaptureRecordSchema, type CaptureRecord } from "@/lib/capture/contracts";
import { formatObservation } from "@/lib/capture/display";
import { SubjectiveEventRegistry } from "@/lib/domain";
import type { ConversationTurn } from "@/lib/db/records";

export function TurnCapture({ turn, saved, autoReady, record, onRecord, managed=false }: { managed?:boolean; turn:ConversationTurn; saved:boolean; autoReady:boolean; record:CaptureRecord|null; onRecord:(record:CaptureRecord)=>void }) {
 const {session,refreshHistory}=useHealthSession();
 const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [text,setText]=useState("");
 const [editing,setEditing]=useState(false);
 const started=useRef(false); const active=useRef(true);
 const followup=useRef<{id:string;text:string;revision:number}|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 async function capture(correct=false) {
  if(!session || !saved || busy) return;
  setBusy(true);setError(null);
  if(correct) {
   if(!record || !text.trim()) {setBusy(false);return;}
   if(!followup.current || followup.current.text!==text.trim()) followup.current={id:crypto.randomUUID(),text:text.trim(),revision:record.revision};
  }
  try {
   const response=await fetch("/api/capture",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({turnId:turn.id,...(correct?{followup:followup.current}:{})})});
   const result=await response.json();
   if(!response.ok) throw new Error(result.error || "Observations could not be saved.");
   const value=CaptureRecordSchema.parse(result.record);
   if(value.rootTurnId!==turn.id) throw new Error("Capture history mismatch.");
   if(active.current) {onRecord(value);refreshHistory(); if(correct){setEditing(false);setText("");followup.current=null;}}
  } catch(error) {if(active.current)setError(error instanceof Error?error.message:"Capture failed. Retry.");}
  finally {if(active.current)setBusy(false);}
 }
 useEffect(()=>{
  if(!managed && autoReady && saved && !record && !started.current && !turn.id.startsWith("capture:") && !turn.id.startsWith("demo:")) {started.current=true;void capture();}
  // Start once when a finalized turn is confirmed saved. Retries are explicit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[saved,record,autoReady,managed]);
 if(managed && !record) return null;
 if(turn.id.startsWith("capture:")) return <p className="small">Clarification/correction transcript. Its observations are shown under the original turn.</p>;
 if(turn.id.startsWith("demo:")) return null;
 return <div className="turn-capture" aria-label="Observation capture">
  <p role="status">{!saved?"Save this transcript before capturing observations.":busy?"Capturing observations…":record?.pending?"Capture interrupted or still processing. Retry to recover.":record?.result?.status==="captured"?"Observations saved":record?.result?.status==="nothing_trackable"?"No trackable observation":record?.result?.status==="needs_clarification"?"Clarification needed":"Ready to capture"}</p>
  {record?.result && record.result.status!=="captured" && <p>{record.result.reason}</p>}
  {record?.acceptedResult?.status==="captured" && <><ul>{record.acceptedResult.events.map(event=><li key={event.id}><strong>{SubjectiveEventRegistry[event.type].label}</strong>: {formatObservation(event)} <span className="small">· {new Intl.DateTimeFormat(undefined,{timeZone:event.timeZone,dateStyle:"medium"}).format(new Date(event.occurredAt))} ({event.timeZone})</span></li>)}</ul>{record.result?.status!=="captured" && <p className="small">Earlier saved observations remain until a complete correction is accepted.</p>}</>}
  {error && <p role="alert">{error}</p>}
  <div className="voice-actions">
   {(!record || record.pending || error) && <button disabled={!saved||busy} onClick={()=>void capture()}>Retry capture</button>}
   {record && <button disabled={busy||record.pending} onClick={()=>setEditing(v=>!v)}>{record.result?.status==="needs_clarification"?"Clarify this observation":"Correct this observation"}</button>}
  </div>
  {editing && <form onSubmit={event=>{event.preventDefault();void capture(true);}}>
   <label>Clarification or correction<textarea maxLength={2000} value={text} onChange={event=>setText(event.target.value)} required disabled={busy}/></label>
   <p className="small">Clarify the original statement. “Yesterday” refers to the day before that original turn. A complete correction replaces its earlier observations; the transcript and capture revisions remain traceable.</p>
   <button disabled={busy||!text.trim()} type="submit">Save clarification/correction</button>
  </form>}
 </div>;
}
