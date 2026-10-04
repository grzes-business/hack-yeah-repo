import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExtractionResultSchema, getLocalDate, type ExtractionResult } from "../domain";
import type { Database, Json } from "../db/database.types";
import { RequestFailure } from "../db/server";
import { featureWriter, readFeatureGeneration } from "../features/server";
import { investigateOwnedOutcome } from "../investigation/server";
import { extractCandidates } from "../capture/provider";
import { canonicalizeExtraction } from "../capture/canonicalize";
import { LoopSchema, QUESTION_POLICY, type QuestionAction, type QuestionLoop } from "./contracts";
import { guardQuestionAnswer } from "./answer";
import { selectBestQuestion } from "./select";
import { analysisVersion } from "../analytics/contracts";
import { builderVersion } from "../features/contracts";

// Upgrade the brief initial Stage 9 state shape without changing historical observations.
function storedLoop(payload:unknown){const raw=payload as Record<string,unknown>;return LoopSchema.parse({processed:[],...raw});}
async function load(client:SupabaseClient<Database>,owner:string){
 const result=await client.from("evidence_question_loops").select("revision,payload").eq("user_id",owner).maybeSingle();
 if(result.error)throw new RequestFailure("Question storage is unavailable. Apply Stage 9 migration 010.",503);
 return {revision:result.data?.revision??0,loop:result.data?storedLoop(result.data.payload):null};
}
function compatible(loop:QuestionLoop,zone:string){return loop.current.bundle.dailyFeatures.timeZone===zone&&loop.current.bundle.analysisVersion===analysisVersion(loop.input.scope)&&loop.current.bundle.dailyFeatures.builderVersion===builderVersion(loop.input.scope);}
export async function readQuestionLoop(client:SupabaseClient<Database>,owner:string){
 const view=await load(client,owner),state=await readFeatureGeneration(featureWriter(),owner);
 return {...view,fresh:!!view.loop&&!view.loop.needsRefresh&&compatible(view.loop,state.timeZone)&&view.loop.current.inputGeneration===state.generation};
}
export async function processedQuestionTurn(client:SupabaseClient<Database>,owner:string,turnId:string){
 const result=await client.from("conversation_turns").select("id").eq("user_id",owner).eq("id",`${turnId}:question`).eq("role","assistant").maybeSingle();
 if(result.error)throw new RequestFailure("Answer replay could not be checked.",503);
 return !!result.data;
}
export async function questionAction(client:SupabaseClient<Database>,owner:string,action:QuestionAction, sourceTurn?:{id:string;at:string;text:string}){
 const writer=featureWriter();let view=await load(client,owner);
 if(sourceTurn&&await processedQuestionTurn(client,owner,sourceTurn.id)){
  if(view.loop?.needsRefresh)return questionAction(client,owner,{action:"refresh",revision:view.revision});
  return readQuestionLoop(client,owner);
 }
 if(action.action==="answer"&&view.loop?.processed.some(answer=>answer.id===action.answerId)){
  const prior=view.loop.processed.find(answer=>answer.id===action.answerId)!;
  if(prior.text!==action.text)throw new RequestFailure("A completed answer cannot be replaced by reusing its ID.",409);
  // A lost voice receipt may retry after the selected question has advanced. Never reinterpret it as an answer to the next question.
  if(view.loop.needsRefresh)return questionAction(client,owner,{action:"refresh",revision:view.revision});
  return readQuestionLoop(client,owner);
 }
 if(action.revision!==view.revision)throw new RequestFailure("Question state changed in another request. Reload it before continuing.",409);
 async function commit(loop:QuestionLoop,capture:unknown=null,staleStop=false){
  const state=await readFeatureGeneration(writer,owner);
  if(!compatible(loop,state.timeZone)&&!staleStop)throw new RequestFailure("Your time zone or analytical policy changed. Start a new investigation.",409);
  // A refreshed snapshot must still be current at the transaction's generation lock.
  if((!loop.needsRefresh||capture!==null)&&loop.current.inputGeneration!==state.generation)throw new RequestFailure("Observations changed. Refresh the investigation before continuing.",409);
  const saved=await writer.rpc("commit_question_loop",{p_owner:owner,p_revision:view.revision,p_generation:state.generation,p_zone:state.timeZone,p_state:LoopSchema.parse(loop) as unknown as Json,p_capture:capture as Json|null});
  if(saved.error)throw new RequestFailure(saved.error.code==="P0001"?"Question or observations changed. Reload and retry.":"The answer was not confirmed. Reload question state and retry.",saved.error.code==="P0001"?409:503);
  view={revision:saved.data,loop};
 }
 if(action.action==="start"){
  if(view.loop?.pending)throw new RequestFailure("Recover the pending answer before starting another investigation.",409);
  const current=await investigateOwnedOutcome(client,owner,action.input);
  // Starting the same investigation preserves voluntary exclusions and its original comparison.
  const same=view.loop&&JSON.stringify(view.loop.input)===JSON.stringify(action.input)&&compatible(view.loop,current.bundle.dailyFeatures.timeZone);
  const skipped=same?view.loop!.skipped:[],resolved=same?view.loop!.resolved:[];
  await commit({policy:QUESTION_POLICY,id:same?view.loop!.id:randomUUID(),input:action.input,before:same?view.loop!.before:current,current,question:selectBestQuestion(current.bundle,[...skipped,...resolved]),skipped,resolved,processed:same?view.loop!.processed:[],stopped:false,pending:null,needsRefresh:false,feedback:null});
 }else{
  const loop=view.loop;if(!loop)throw new RequestFailure("Start an investigation first.",409);
  const state=await readFeatureGeneration(writer,owner);
  if(!compatible(loop,state.timeZone)){
   if(action.action!=="stop")throw new RequestFailure("Your time zone changed. Stop the old question and start a new investigation.",409);
   if(loop.pending&&Date.parse(loop.pending.leaseUntil)>Date.now())throw new RequestFailure("The answer is processing. Wait briefly before stopping.",409);
   // Stopping is a state-only action: it must not require rebuilding an old date that may now be future in the new zone.
   await commit({...loop,stopped:true,question:null,pending:null,needsRefresh:true,feedback:"Questioning stopped after a time-zone/policy change. Start a new investigation; no pending answer was recorded."},null,true);
   return readQuestionLoop(client,owner);
  }
  if(action.action==="refresh"&&loop.pending)throw new RequestFailure("Retry or skip the pending answer before refreshing its question.",409);
  if(action.action==="stop"||action.action==="skip"){
   if(loop.pending&&Date.parse(loop.pending.leaseUntil)>Date.now())throw new RequestFailure("The answer is processing. Wait briefly before skipping or stopping.",409);
   if(action.action==="stop")await commit({...loop,stopped:true,question:null,pending:null,needsRefresh:true,feedback:"Questioning stopped. Missing context remains unknown."});
   else{
    if(!loop.question)throw new RequestFailure("There is no active question to skip.",409);
    const skipped=[...new Set([...loop.skipped,loop.question.key])];
    await commit({...loop,skipped,question:null,pending:null,needsRefresh:true,feedback:"Skipped. No observation was recorded."});
   }
  }else if(action.action==="answer"){
   if(loop.processed.length>=100)throw new RequestFailure("This investigation reached its answer limit. Start a different investigation before continuing.",409);
   if(loop.stopped||!loop.question)throw new RequestFailure("There is no active question to answer.",409);
   if(loop.needsRefresh)throw new RequestFailure("The last answer was saved. Refresh evidence before answering again.",409);
   if(loop.current.inputGeneration!==state.generation)throw new RequestFailure("History changed. Refresh before answering this question.",409);
   let pending=loop.pending;
   if(pending){
    if(pending.id!==action.answerId||pending.text!==action.text)throw new RequestFailure("Retry the pending answer using its original text and ID.",409);
    if(Date.parse(pending.leaseUntil)>Date.now())throw new RequestFailure("The answer is processing. Wait briefly before retrying.",409);
   }
   if(sourceTurn&&sourceTurn.text!==action.text)throw new RequestFailure("Answer transcript mismatch.",409);
   const at=pending?.at??sourceTurn?.at??new Date().toISOString();
   pending={id:action.answerId,text:action.text,at,turnId:pending?.turnId??sourceTurn?.id??`question-answer:${loop.id}:${action.answerId}`,leaseUntil:new Date(Date.now()+90000).toISOString()};
   await commit({...loop,pending,feedback:"Answer processing; no observation is confirmed yet."});
   let result:ExtractionResult;
   try{
    const candidates=await extractCandidates({transcript:pending.text,followup:null,previousResult:null,anchorDate:getLocalDate(at,state.timeZone),timeZone:state.timeZone,question:loop.question});
    result=canonicalizeExtraction(candidates,{rootTurnId:pending.turnId,sourceTurnId:pending.turnId,anchorAt:at,capturedAt:at,timeZone:state.timeZone,sourceText:`${loop.question.text}\nAnswer: ${pending.text}`});
    result=guardQuestionAnswer(result,loop.question,pending.text);
    if(result.status==="captured"&&loop.input.scope==="demo")result=ExtractionResultSchema.parse({...result,events:result.events.map(e=>({...e,id:`demo:question:${e.id}`}))});
   }catch{
    await commit({...loop,pending:{...pending,leaseUntil:new Date(0).toISOString()},feedback:"Extraction failed. No new observation was confirmed. Retry the pending answer."});
    return readQuestionLoop(client,owner);
   }
   const targetAnswered=result.status==="captured"&&result.events.some(e=>e.type===loop.question!.feature&&getLocalDate(e.occurredAt,state.timeZone)===loop.question!.date);
   const resolved=targetAnswered?[...new Set([...loop.resolved,loop.question.key])]:loop.resolved;
   const feedback=result.status==="captured"?targetAnswered?"Answer recorded. Evidence refresh is pending.":"Reported observations were saved, but they did not answer the selected dated question.":result.reason;
   await commit({...loop,pending:null,resolved,processed:[...loop.processed,{id:pending.id,text:pending.text,turnId:pending.turnId}],needsRefresh:result.status==="captured",feedback}, {turnId:pending.turnId,at:pending.at,text:pending.text,question:loop.question.text,result});
  }
  // Refresh after confirmed writes; if rebuilding fails the durable needsRefresh state permits recovery without recapture.
  const saved=view.loop!;
  if(saved.needsRefresh||action.action==="refresh"){
   const current=await investigateOwnedOutcome(client,owner,saved.input);
   await commit({...saved,current,needsRefresh:false,question:saved.stopped?null:selectBestQuestion(current.bundle,[...saved.skipped,...saved.resolved]),feedback:saved.feedback==="Answer recorded. Evidence refresh is pending."?"Answer recorded and evidence refreshed.":saved.feedback});
  }
 }
 return readQuestionLoop(client,owner);
}
