"use client";

import { MicrophoneIcon, WaveformIcon, StopIcon, MicrophoneSlashIcon, SunHorizonIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useHealthSession } from "./session";
import { morningPrompt, pendingDimensions } from "@/lib/checkin/prompt";
import { useTalkContext } from "./talk-context";
import type { VoiceContext } from "@/lib/conversation/controller-contracts";
import { TurnCapture } from "./turn-capture";
import { CaptureRecordSchema, type CaptureRecord } from "@/lib/capture/contracts";
import { VoiceTransport, type VoiceInputOptions, type VoiceActivity } from "@/lib/conversation/transport";
import { VoiceOutcomeSchema, type VoiceOutcome } from "@/lib/conversation/controller-contracts";
import { observationText } from "@/lib/conversation/feedback";
import { readTranscriptEvent } from "@/lib/conversation/events";
import { ConversationSchema, ConversationTurnSchema, type Conversation, type ConversationTurn } from "@/lib/db/records";

// Lets other panels (such as the morning check-in) re-read accepted observations after a voice save.
export const HEALTH_HISTORY_CHANGED = "health-history-changed";
type Pending = { kind: "conversation"; value: Conversation } | { kind: "turn"; value: ConversationTurn };
type Phase = "idle" | "requesting" | "connecting" | "active" | "stopping" | "failed";
function devWindowHeaders():Record<string,string>{
 if(process.env.NODE_ENV==="production")return {};
 try{const value=localStorage.getItem("checkin-dev-window");return value?{"x-checkin-dev-window":value}:{};}catch{return {};}
}
const labels: Record<Phase, string> = { idle: "Microphone off", requesting: "Waiting for microphone permission…", connecting: "Connecting voice…", active: "Conversation live", stopping: "Stopping…", failed: "Microphone off · connection ended" };

// Fixed microphone defaults; the settings panel was removed from Talk.
const VOICE_INPUT: VoiceInputOptions = { microphone: "laptop", sensitivity: "less_sensitive", mode: "press_to_speak" };

export function VoiceConversation() {
 const { session } = useHealthSession();
 return <VoiceSession key={session?.user.id ?? "signed-out"} />;
}

function VoiceSession() {
 const { session, repository, refreshHistory } = useHealthSession();
 const talk=useTalkContext();
 const contextRef=useRef(talk.context),promptRef=useRef(talk.prompt),announced=useRef(-1);
 useEffect(()=>{contextRef.current=talk.context;promptRef.current=talk.prompt;},[talk.context,talk.prompt]);
 const owner = session?.user.id;
 const [phase, setPhase] = useState<Phase>("idle");
 const [message, setMessage] = useState<string | null>(null);
 const [muted, setMuted] = useState(false);
 const voiceInput = VOICE_INPUT;
 const [activity,setActivity]=useState<VoiceActivity>("ready");
 const [processing,setProcessing]=useState(false);
 const [voiceOutcomes,setVoiceOutcomes]=useState<Record<string,VoiceOutcome>>({});
 const [voiceErrors,setVoiceErrors]=useState<Record<string,string>>({});
 const [voiceHistoryFor,setVoiceHistoryFor]=useState<string|null>(null);
 const [voiceTarget,setVoiceTarget]=useState<string|null>(null);
 const targetRef=useRef<string|null>(null);
 const voiceEpoch=useRef(0);
 const voiceQueue=useRef<{turn:ConversationTurn;run:number;epoch:number;target:string|null;context:VoiceContext}[]>([]);
 const voiceQueued=useRef(new Set<string>());
 const processingRef=useRef(false);
 const controllerAbort=useRef<AbortController|null>(null);
 const [conversations, setConversations] = useState<Conversation[]>([]);
 const [selected, setSelected] = useState<string | null>(null);
 const [captures, setCaptures] = useState<Record<string,CaptureRecord>>({});

 const [captureHistoryError, setCaptureHistoryError] = useState<string | null>(null);
 const [turns, setTurns] = useState<ConversationTurn[]>([]);
 const [drafts, setDrafts] = useState<Record<string, { role: string; text: string }>>({});
 const [pendingSnapshot, setPendingSnapshot] = useState<Pending[]>([]);
 const [saving, setSaving] = useState(false);
 const [historyError, setHistoryError] = useState<string | null>(null);
 const [historyRevision, setHistoryRevision] = useState(0);
 const audio = useRef<HTMLAudioElement>(null);
 const pausedByTab = useRef(false);
 const transport = useRef<VoiceTransport | null>(null);
 const current = useRef<Conversation | null>(null);
 const pending = useRef(new Map<string, Pending>());
 const finalIds = useRef(new Set<string>());
 const generation = useRef(0);
 const alive = useRef(true);
 const savingRef = useRef(false);
 const uid = useRef(owner);
 useEffect(() => { uid.current = owner; }, [owner]);
 const busy = ["requesting", "connecting", "active", "stopping"].includes(phase);
 const storageKey = owner ? `personal-evidence:voice-pending:${owner}` : null;

 function chooseTarget(root:string|null,manual=false){
  if(manual){contextRef.current={mode:"report"};talk.select({mode:"report"},undefined,false);}
  targetRef.current=root;setVoiceTarget(root);
  if(owner){try{if(root)sessionStorage.setItem(`personal-evidence:voice-target:${owner}`,root);else sessionStorage.removeItem(`personal-evidence:voice-target:${owner}`);}catch{/* Explicit card selection remains available. */}}
 }
 async function pumpVoice(){
  if(processingRef.current||!session||!owner)return;
  processingRef.current=true;if(alive.current)setProcessing(true);
  try{
   while(voiceQueue.current.length&&alive.current&&uid.current===owner){
    const entry=voiceQueue.current[0];
    if(pending.current.has(`turn:${entry.turn.id}`))break;
    voiceQueue.current.shift();
    const abort=new AbortController();controllerAbort.current=abort;
    try{
     const response=await fetch("/api/voice/turn",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",...devWindowHeaders()},body:JSON.stringify({turnId:entry.turn.id,targetRootId:entry.target,context:entry.context,scope:talk.scope}),signal:abort.signal});
     const body=await response.json();if(!response.ok)throw new Error(body.error||"Voice processing failed. Retry this turn.");
     const outcome=VoiceOutcomeSchema.parse(body.outcome);if(outcome.turnId!==entry.turn.id)throw new Error("Voice result mismatch.");
     if(!alive.current||uid.current!==owner)return;
     setVoiceOutcomes(v=>({...v,[entry.turn.id]:outcome}));setVoiceErrors(v=>{const next={...v};delete next[entry.turn.id];return next;});
     if(outcome.capture)setCaptures(v=>{const previous=v[outcome.capture!.rootTurnId];return previous&&previous.revision>outcome.capture!.revision?v:{...v,[outcome.capture!.rootTurnId]:outcome.capture!};});
     if(entry.run===generation.current&&entry.epoch===voiceEpoch.current){
      if(outcome.disposition==="cancel"||outcome.investigation||outcome.questions)chooseTarget(null);
      else if(outcome.capture){
       // Only unresolved questions become automatic follow-up targets. A saved report
       // must not make the next independent intake/negative report a replacement.
       const needsAnswer=outcome.capture.result?.status==="needs_clarification";
       chooseTarget(needsAnswer?outcome.targetRootId:null);
      }
      if(outcome.questions?.loop){
       const loop=outcome.questions.loop;
       if(loop.question&&!loop.stopped){const next:VoiceContext={mode:"investigate",loopId:loop.id,key:loop.question.key};contextRef.current=next;talk.select(next,loop.question.text,false);}
       else {contextRef.current={mode:"report"};talk.select({mode:"report"},undefined,false);}
      }
      if(outcome.checkin){
       const state=outcome.checkin as {localDate:string;step:{kind:string;dimension:"energy"|"soreness"|"mood"|"illness";question:string}};
       if(state.step.kind==="ask"){const next:VoiceContext={mode:"morning_checkin",date:state.localDate,dimension:state.step.dimension};contextRef.current=next;talk.select(next,state.step.question,false);}
       else {contextRef.current={mode:"report"};talk.select({mode:"report"},undefined,false);}
      }
      if(outcome.reply&&entry.epoch===voiceEpoch.current)transport.current?.say(outcome.reply,entry.turn.id);
     }
     refreshHistory();setHistoryRevision(v=>v+1);window.dispatchEvent(new Event(HEALTH_HISTORY_CHANGED));
    }catch(error){
     if(!alive.current||uid.current!==owner)return;
     const message=error instanceof Error&&error.name!=="AbortError"?error.message:"Processing interrupted. Retry this saved turn.";
     setVoiceErrors(v=>({...v,[entry.turn.id]:message}));
     if(entry.run===generation.current&&entry.epoch===voiceEpoch.current)transport.current?.say("This turn could not be processed reliably. Check its card and retry. Saving is not confirmed.",`failed:${entry.turn.id}`);
    }finally{controllerAbort.current=null;voiceQueued.current.delete(entry.turn.id);}
   }
  }finally{processingRef.current=false;if(alive.current)setProcessing(false);}
 }
 function queueVoice(turn:ConversationTurn,run=generation.current,epoch=voiceEpoch.current,target=targetRef.current){
  if(voiceQueued.current.has(turn.id))return;
  voiceQueued.current.add(turn.id);voiceQueue.current.push({turn,run,epoch,target,context:contextRef.current});void pumpVoice();
 }
 function publish() {
  if (!alive.current) return;
  setPendingSnapshot([...pending.current.values()]);
  if (storageKey) {
   try { if (pending.current.size) sessionStorage.setItem(storageKey, JSON.stringify([...pending.current.values()])); else sessionStorage.removeItem(storageKey); }
   catch { setMessage("This browser cannot keep an unsaved recovery copy. Keep this page open and retry saving before leaving."); }
  }
 }
 function enqueue(item: Pending) { pending.current.set(`${item.kind}:${item.value.id}`, item); publish(); }
 async function flush() {
  if (!repository || !owner || savingRef.current || uid.current !== owner) return;
  savingRef.current = true; setSaving(true);
  try {
   while (pending.current.size) {
    const [key, item] = pending.current.entries().next().value!;
    if (uid.current !== owner) break;
    if (item.kind === "conversation") await repository.saveConversation(item.value, owner);
    else await repository.saveTurn(item.value, owner);
    if (pending.current.get(key) === item) pending.current.delete(key);
    publish();
   }
   if (alive.current && uid.current === owner) { refreshHistory(); setHistoryRevision(v => v + 1); void pumpVoice(); }
  } catch { if (alive.current) setMessage("Some transcript changes are not saved. Retry saving; the recovery copy stays in this tab when available."); }
  finally { savingRef.current = false; if (alive.current) setSaving(false); }
 }
 function finish(failed = false) {
  generation.current += 1;
  transport.current?.close(); transport.current = null;
  voiceEpoch.current+=1;setActivity("ready");
  setMuted(false); setDrafts({});
  if (current.current) {
   const ended = { ...current.current, endedAt: new Date().toISOString() };
   current.current = null; enqueue({ kind: "conversation", value: ended });
   setConversations(v => [ended, ...v.filter(c => c.id !== ended.id)]);
   void flush();
  }
  setPhase(failed ? "failed" : "idle");
 }
 useEffect(() => {
  alive.current = true;
  const recoveryQueue = pending.current;
  return () => {
   alive.current = false; controllerAbort.current?.abort(); generation.current += 1; transport.current?.close();
   const conversation = current.current;
   if (conversation && repository && owner) {
    const ended = { ...conversation, endedAt: new Date().toISOString() };
    recoveryQueue.set(`conversation:${ended.id}`, { kind: "conversation", value: ended });
    try { sessionStorage.setItem(`personal-evidence:voice-pending:${owner}`, JSON.stringify([...recoveryQueue.values()])); } catch { /* Recovery may be unavailable in private browsing. */ }
    void repository.saveConversation(ended, owner).catch(() => { /* Recovery copy remains for the next visit. */ });
   }
  };
 }, [owner, repository]);
 useEffect(() => {
  pending.current.clear(); finalIds.current.clear(); current.current = null;
  if (!owner) return;
  try {const root=sessionStorage.getItem(`personal-evidence:voice-target:${owner}`);queueMicrotask(()=>{if(alive.current&&uid.current===owner){targetRef.current=root;setVoiceTarget(root);}});}catch{/* Select a card to resume. */}
  try {
   const raw = sessionStorage.getItem(`personal-evidence:voice-pending:${owner}`);
   if (raw) for (const item of JSON.parse(raw) as Pending[]) {
    const value = item.kind === "conversation" ? ConversationSchema.parse(item.value) : ConversationTurnSchema.parse(item.value);
    if (item.kind !== "conversation" && item.kind !== "turn") continue;
    pending.current.set(`${item.kind}:${value.id}`, { kind: item.kind, value } as Pending);
   }
  } catch { sessionStorage.removeItem(`personal-evidence:voice-pending:${owner}`); }
  setPendingSnapshot([...pending.current.values()]);
 }, [owner]);
 useEffect(() => {
  if (!repository || !owner) return;
  let active = true;
  repository.listConversations().then(value => { if (active) { setConversations(value.filter(c => c.mode === "capture")); setHistoryError(null); } }).catch(() => { if (active) setHistoryError("Conversation history could not load. Retry history."); });
  return () => { active = false; };
 }, [owner, repository, historyRevision]);
 useEffect(() => {
  if (!selected || !repository || !owner) return;
  let active = true;
  repository.listTurns(selected).then(value => { if (active) { setTurns(value); setHistoryError(null); } }).catch(() => { if (active) setHistoryError("Transcript history could not load. Retry history."); });
  return () => { active = false; };
 }, [selected, repository, owner, historyRevision]);


 useEffect(() => {
  if (!selected || !session) return;
  let active = true;
  fetch(`/api/capture?conversationId=${encodeURIComponent(selected)}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(async response => {
   const body = await response.json();
   if (!response.ok) throw new Error(body.error || "Capture history could not load.");
   const records: CaptureRecord[] = body.records.map((value: unknown) => CaptureRecordSchema.parse(value));
   if (active) {
    setCaptures(previous => { const next = { ...previous }; for (const value of records) if (!next[value.rootTurnId] || next[value.rootTurnId].revision <= value.revision) next[value.rootTurnId] = value; return next; });
    setCaptureHistoryError(null);
   }
  }).catch(error => { if (active) { setCaptureHistoryError(error instanceof Error ? error.message : "Capture history could not load."); } });
  return () => { active = false; };
 }, [selected, session, historyRevision]);

 useEffect(()=>{
  if(!selected||!session)return;
  let active=true;
  fetch(`/api/voice/turn?conversationId=${encodeURIComponent(selected)}`,{headers:{Authorization:`Bearer ${session.access_token}`}}).then(async response=>{
   const body=await response.json();if(!response.ok)throw new Error(body.error||"Voice history could not load.");
   const outcomes=(body.runs as {outcome:unknown}[]).filter(r=>r.outcome!==null).map(r=>VoiceOutcomeSchema.parse(r.outcome));
   if(active){setVoiceOutcomes(v=>{const next={...v};for(const o of outcomes)next[o.turnId]=o;return next;});setVoiceHistoryFor(selected);}
  }).catch(error=>{if(active)setMessage(error instanceof Error?error.message:"Voice history could not load.");});
  return()=>{active=false;};
 },[selected,session,historyRevision]);
 useEffect(()=>{
  // Listening pauses while the tab is in the background and resumes on return; the microphone is never left muted by focus changes.
  const pause=()=>{if(transport.current){transport.current.setPaused(true);pausedByTab.current=true;setMessage("Listening paused while this tab is in the background. It resumes when you return.");}};
  const resume=()=>{if(transport.current&&document.visibilityState==="visible"){transport.current.setPaused(false);if(pausedByTab.current){pausedByTab.current=false;setMessage(null);}}};
  const onVisibility=()=>{if(document.visibilityState==="hidden")pause();else resume();};
  window.addEventListener("blur",pause);window.addEventListener("focus",resume);document.addEventListener("visibilitychange",onVisibility);
  return()=>{window.removeEventListener("blur",pause);window.removeEventListener("focus",resume);document.removeEventListener("visibilitychange",onVisibility);};
 },[]);
 useEffect(()=>{
  if(phase==="active"&&talk.prompt&&announced.current!==talk.request&&!processingRef.current){announced.current=talk.request;transport.current?.say(talk.prompt,`prompt:${talk.request}`);}
 },[phase,talk.prompt,talk.request,processing]);
 async function beginMorning(){
  if(!session||processing)return;
  try{
   const devHeaders=devWindowHeaders();
   const response=await fetch("/api/checkin",{headers:{Authorization:`Bearer ${session.access_token}`,...devHeaders}});
   const body=await response.json();if(!response.ok)throw new Error(body.error);
   if(body.checkin.step.kind!=="ask"){setMessage(body.checkin.step.kind==="complete"?"Morning check-in is complete for today.":"Morning check-in is closed. Open its development controls below to change the test window.");return;}
   // One sentence answers every open dimension; it is captured as an ordinary report.
   const prompt=morningPrompt(pendingDimensions(body.checkin.answered,body.checkin.skipped));const next:VoiceContext={mode:"report"};contextRef.current=next;promptRef.current=prompt;
   chooseTarget(null);talk.select(next,prompt);
   if(!busy)await start();
  }catch(failure){setMessage(failure instanceof Error?failure.message:"Morning check-in could not start.");}
 }
 async function start() {
  if (!session || !repository || !audio.current || transport.current || pending.current.size) return;
  const run = ++generation.current;
  const id = crypto.randomUUID();
  setMessage(null); setTurns([]); setDrafts({}); setSelected(id); finalIds.current.clear(); setMuted(false);
  const connection = new VoiceTransport(audio.current, {
   activity: value=>{if(generation.current===run)setActivity(value);},
   interrupted: ()=>{if(generation.current===run)voiceEpoch.current+=1;},
   state: state => { if (generation.current === run) setPhase(state); },
   created: startedAt => {
    if (generation.current !== run) {
     if (!alive.current) { void repository.saveConversation({ id, mode: "capture", startedAt, endedAt: new Date().toISOString() }, session.user.id).catch(() => {}); return; }
     enqueue({ kind: "conversation", value: { id, mode: "capture", startedAt, endedAt: new Date().toISOString() } }); void flush(); return;
    }
    current.current = { id, mode: "capture", startedAt, endedAt: null };
    setConversations(v => [current.current!, ...v.filter(c => c.id !== id)]);
   },
   notice: notice => { if (generation.current === run) setMessage(notice); },
   error: error => { if (generation.current === run) { setMessage(error); finish(true); } },
   event: event => {
    if (generation.current !== run) return;
    const update = readTranscriptEvent(event, id, new Date().toISOString());
    if (!update || finalIds.current.has(update.key)) return;
    if (update.final && update.turn) {
     finalIds.current.add(update.key);
     setDrafts(v => { const next = { ...v }; delete next[update.key]; return next; });
     setTurns(v => [...v.filter(t => t.id !== update.key), update.turn!]);
     enqueue({ kind: "turn", value: update.turn });
     if(update.turn.role==="user")queueVoice(update.turn,run,connection.isCurrentInput(event)?voiceEpoch.current:-1,targetRef.current);
     void flush();
    } else setDrafts(v => ({ ...v, [update.key]: { role: update.role, text: ((v[update.key]?.text ?? "") + update.text).slice(0,20000) } }));
   },
  });
  transport.current = connection;
  try { await connection.start(session.access_token, id, voiceInput); }
  catch (error) {
   if (generation.current !== run) return;
   // Setup may have inserted a conversation before a network/SDP failure.
   try { const created = (await repository.listConversations()).find(c => c.id === id); if (created) current.current = created; } catch { /* History exposes an unrecorded end if storage cannot be reached. */ }
   if (generation.current !== run) return;
   const denied = error instanceof DOMException && error.name === "NotAllowedError";
   setMessage(denied ? "Microphone permission was denied. Allow it in your browser settings, then retry." : error instanceof Error ? error.message : "Voice could not start. Check your microphone and connection.");
   finish(true);
  }
 }
 const pendingTurns = pendingSnapshot.filter((v): v is Extract<Pending, { kind: "turn" }> => v.kind === "turn" && v.value.conversationId === selected).map(v => v.value);
 const displayed = [...new Map([...turns, ...pendingTurns].map(t => [t.id, t])).values()].sort((a,b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));

 return <>
  <section id="voice-controls" className="card card-body bg-base-100 border border-base-300 voice-hub" aria-label="Voice conversation">
   <div className="mode-row">{talk.scope==="demo"&&<span className="badge badge-soft badge-info">Synthetic demo data</span>}<span className="badge badge-soft badge-primary">{talk.context.mode==="report"?"Personal reporting":talk.context.mode==="morning_checkin"?"Morning check-in":"Investigation answer"}</span>{talk.context.mode!=="report"&&<button className="btn btn-soft" disabled={processing} onClick={()=>{chooseTarget(null);talk.select({mode:"report"});}}>Return to reporting</button>}</div>
   {talk.prompt&&<p className="current-question"><strong>{talk.prompt}</strong></p>}
<p className="voice-status" role="status">{labels[phase]}{phase==="active"?` · ${processing?"Processing saved speech…":activity==="recording"?"Listening…":activity==="transcribing"?"Transcribing…":activity==="replying"?"Speaking…":voiceInput.mode==="press_to_speak"?"Hold the button to speak":"Listening for speech"}`:""}{muted && phase === "active" ? " · microphone muted" : ""}</p>
   {<button className="btn btn-primary btn-circle speak-button" disabled={!session||!repository||phase==="requesting"||phase==="connecting"||muted||saving||pendingSnapshot.length>0} onClick={()=>{if(!busy)void start();}} aria-label={!busy?"Start voice":activity==="recording"?"Release to send":"Hold to speak"} aria-pressed={activity==="recording"}
    onPointerDown={event=>{event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);if(phase==="active")transport.current?.beginSpeech();}}
    onPointerUp={()=>transport.current?.endSpeech()}
    onPointerCancel={()=>transport.current?.endSpeech(true)} onLostPointerCapture={()=>transport.current?.endSpeech(true)} onBlur={()=>transport.current?.endSpeech(true)}
    onKeyDown={event=>{if([" ","Enter"].includes(event.key)){event.preventDefault();if(!event.repeat){if(phase==="active")transport.current?.beginSpeech();else if(!busy)void start();}}}}
    onKeyUp={event=>{if([" ","Enter"].includes(event.key)){event.preventDefault();transport.current?.endSpeech();}}}
   ><span className="mic-symbol" aria-hidden="true">{activity==="recording"?<WaveformIcon size={42} weight="regular"/>:<MicrophoneIcon size={42} weight="regular"/>}</span><span className="mic-label">{!busy?"Start voice":activity==="recording"?"Release to send":voiceInput.mode==="press_to_speak"?"Hold to speak":"Listening"}</span></button>}
   <p className="mic-hint">{phase==="active"?voiceInput.mode==="press_to_speak"?"Hold to talk. Release to send.":"Speak naturally. Mute to pause.":"Tap the microphone to connect."}</p>
   <button className="btn btn-soft checkin-shortcut" disabled={!session||processing||phase==="requesting"||phase==="connecting"} onClick={()=>void beginMorning()}><SunHorizonIcon size={20} aria-hidden="true"/> Morning check-in</button>
   <div className="voice-actions call-controls">
    <button onClick={() => { setPhase("stopping"); finish(); }} disabled={!busy} className="btn btn-soft"> <StopIcon size={18} aria-hidden="true"/> End call</button>
    <button onClick={() => { transport.current?.mute(!muted); setMuted(v => !v); }} className="btn btn-soft" disabled={phase !== "active"}><MicrophoneSlashIcon size={18} aria-hidden="true"/>{muted ? "Unmute microphone" : "Mute microphone"}</button>
   </div>

   {voiceTarget&&<p>Voice follow-up target selected. Your next clear clarification or correction will refer to that report. <button className="btn btn-soft" onClick={()=>chooseTarget(null)}>Clear target</button></p>}
   {/* Plays the assistant voice; no visible controls. */}<audio ref={audio} className="voice-audio" aria-hidden="true" />
   {!session && <p>Start a private demo session above to use voice.</p>}
   {message && <p role="alert">{message}</p>}
   {(saving||pendingSnapshot.length>0)&&<p role="status">{saving ? "Saving transcript…" : pendingSnapshot.length ? `${pendingSnapshot.length} changes not saved` : "No pending transcript saves"}</p>}
   {pendingSnapshot.length > 0 && <button className="btn btn-primary" onClick={() => void flush()} disabled={saving}>Retry saving transcript</button>}

  </section>
  {displayed.filter(t=>t.role==="user").slice(-1).map(turn=><section key={turn.id} className="card card-body bg-base-100 border border-base-300 latest-turn"><h2>Latest conversation</h2><p><strong>You:</strong> {turn.transcript}</p><p role="status">{voiceErrors[turn.id]??voiceOutcomes[turn.id]?.reply??(pendingSnapshot.some(v=>v.kind==="turn"&&v.value.id===turn.id)?"Saving transcript…":"Processing your saved words…")}</p>{voiceErrors[turn.id]&&<button className="btn btn-primary" disabled={processing} onClick={()=>queueVoice(turn)}>Retry processing</button>}{captures[turn.id]?.acceptedResult?.status==="captured"&&<span className="badge badge-soft badge-success">Observations confirmed</span>}{captures[turn.id]&&!captures[turn.id].pending&&<button className="btn btn-soft" disabled={processing} onClick={()=>chooseTarget(turn.id,true)}>Correct this report by voice</button>}</section>)}
  <details className="card card-body bg-base-100 border border-base-300 transcript-detail"><summary>Transcripts, saved reports and recovery</summary><section aria-label="Saved conversations">
   <h2>Conversation history</h2>
   <label>Choose a conversation<select className="select w-full" value={selected ?? ""} disabled={busy} onChange={event => { setTurns([]); setSelected(event.target.value || null); }}><option value="">Select history</option>{conversations.map(c => <option key={c.id} value={c.id}>{new Date(c.startedAt).toLocaleString()} {c.endedAt ? "" : "· end not recorded"}</option>)}</select></label>
   {historyError && <p role="alert">{historyError}</p>}
   {captureHistoryError && <p role="alert">{captureHistoryError}</p>}
   <button className="btn btn-soft" onClick={() => setHistoryRevision(v => v + 1)} disabled={busy}>Retry history</button>
   <p className="small">History shows up to 100 conversations and 500 turns per conversation. Unsaved recovery copies stay in this tab’s session storage when available; closing the tab can lose them.</p>
   {!displayed.length && <p>No finalized transcript to show yet.</p>}
   <ol className="voice-transcript">{displayed.map(turn => <li key={turn.id}><strong>{turn.role === "user" ? "You" : "Assistant"}</strong><p>{turn.transcript}</p><span className="small">{new Date(turn.occurredAt).toLocaleTimeString()} · {pendingSnapshot.some(item => item.kind === "turn" && item.value.id === turn.id) ? "Not saved" : "Saved"}</span>{turn.role === "user" && <><div className="voice-result">{voiceOutcomes[turn.id]?.reply&&<p><strong>App feedback for this turn:</strong> {voiceOutcomes[turn.id].reply}</p>}{voiceOutcomes[turn.id]?.disposition==="ignore"&&<p className="small">No reply or observation: non-report input.</p>}{voiceOutcomes[turn.id]?.disposition==="followup"&&<p className="small">This turn was applied to the selected original report.</p>}{voiceErrors[turn.id]&&<p role="alert">{voiceErrors[turn.id]}</p>}{!turn.id.startsWith("capture:")&&!turn.id.startsWith("demo:")&&voiceHistoryFor===selected&&(!voiceOutcomes[turn.id]||voiceErrors[turn.id])&&<button className="btn btn-primary" disabled={processing||pendingSnapshot.some(v=>v.kind==="turn"&&v.value.id===turn.id)} onClick={()=>queueVoice(turn)}>Process / retry this saved turn</button>}{captures[turn.id]&&!captures[turn.id].pending&&<button className="btn btn-primary" onClick={()=>chooseTarget(turn.id,true)} disabled={processing}>Use this report for voice clarification / correction</button>}{voiceOutcomes[turn.id]?.retrieval&&<ul>{voiceOutcomes[turn.id].retrieval!.events.map(e=><li key={e.id}>{new Intl.DateTimeFormat(undefined,{timeZone:voiceOutcomes[turn.id].retrieval!.timeZone,dateStyle:"medium"}).format(new Date(e.occurredAt))}: {observationText(e,"en")} · {e.id.startsWith("demo:")?"Synthetic demo":"Conversation report"}</li>)}</ul>}</div>{voiceOutcomes[turn.id]?.questions?.loop?.question&&<p><strong>Selected context question:</strong> {voiceOutcomes[turn.id].questions!.loop!.question!.text} · <a href="/evidence">Open the current question in Evidence</a></p>}{voiceOutcomes[turn.id]?.investigation&&<details><summary>Investigation evidence and limits</summary><p>Evidence snapshot for {voiceOutcomes[turn.id].investigation!.bundle.dailyFeatures.date}. Historical associations do not prove a cause.</p><ul>{voiceOutcomes[turn.id].investigation!.explanation.facts.map(fact=><li key={fact.id}>{fact.text}</li>)}</ul><a href="/evidence">Open Evidence</a></details>}{voiceOutcomes[turn.id]?.questionAnswer?<p className="small">This answer was processed through the missing-context pipeline. See Evidence and Timeline for its confirmed status.</p>:<TurnCapture managed voiceOnly turn={turn} saved={!pendingSnapshot.some(item => item.kind === "turn" && item.value.id === turn.id)} autoReady={false} record={captures[turn.id] ?? null} onRecord={record => setCaptures(previous => ({ ...previous, [record.rootTurnId]: record }))} />}</>}</li>)}</ol>
   {Object.entries(drafts).map(([key, draft]) => <p key={key} className="voice-draft"><strong>{draft.role === "user" ? "You" : "Assistant"} · live, not saved:</strong> {draft.text}</p>)}
  </section></details>
 </>;
}
