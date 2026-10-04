import { compareEvidence } from "@/lib/questions/select";
import { explicitVoiceDate } from "@/lib/questions/voice-context";
import { shortQuestionAnswer } from "@/lib/questions/answer";
import { questionAction, readQuestionLoop, processedQuestionTurn } from "@/lib/questions/server";
import { freshInvestigationReceipt } from "@/lib/investigation/receipt";
import { featureWriter, readFeatureGeneration } from "@/lib/features/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { VoiceIntentSchema, VoiceOutcomeSchema, VoiceTurnInputSchema, type VoiceOutcome } from "@/lib/conversation/controller-contracts";
import { identifyVoiceIntent } from "@/lib/conversation/intent";
import { untrackedMetricName, unsupportedMetricReply } from "@/lib/conversation/unsupported";
import { captureFeedback, observationText } from "@/lib/conversation/feedback";
import { CaptureRecordSchema } from "@/lib/capture/contracts";
import { addCalendarDays, getLocalDate, TimeZoneSchema } from "@/lib/domain";
import { parseEventRow } from "@/lib/db/ingestion";
import { POST as captureTurn } from "../../capture/route";
import type { Json, Row } from "@/lib/db/database.types";
export const runtime="nodejs";
export const maxDuration=120;
const headers={"Cache-Control":"no-store"};
function claimRefusalMessage(reason: string) {
 if(reason.includes("Completed owned target"))return "The selected report is still saving or has no completed capture. Wait a moment, or clear the follow-up target and try again.";
 if(reason.includes("Owned capture turn"))return "This turn is not part of a capture conversation. Speak again in the Talk conversation.";
 if(reason.includes("Transcript changed"))return "This turn's transcript changed. Reload history and try again.";
 if(reason.includes("Invalid follow-up root"))return "The selected report cannot be its own follow-up target. Clear the target and try again.";
 return "This turn or selected report changed. Reload history and select the report again.";
}
// Completed reports can only be replaced by an explicit correction. Model intent
// alone must not turn another intake or negative report into a destructive replacement.
const correctionPhrase=/\b(actually|correct|correction|correcting|change|replace|amend|update|i meant|instead|rather than|that was wrong|i was wrong)\b|\b(popraw\p{L}*|sprost\p{L}*|korekt\p{L}*|właściwie|jednak|miałem na myśli|miałam na myśli)\b/iu;
const cancelPhrase=/^\W*(cancel|skip|never ?mind|forget it|stop|anuluj|pomi[nń])(\s+(this|that|it|the clarification|that report))?\W*$/iu;
function followupId(turnId:string){const h=createHash("sha256").update("voice-followup-v1:"+turnId).digest("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
export async function POST(request:Request){
 let release:(()=>Promise<void>)|null=null;
 try {
  const {client,owner}=await authenticatedDatabase(request);
  const input=VoiceTurnInputSchema.parse(await boundedJson(request,2000));
  if(input.turnId.startsWith("capture:")||input.turnId.startsWith("demo:"))throw new RequestFailure("Select an original spoken turn.",400);
  const turn=await client.from("conversation_turns").select("*").eq("user_id",owner).eq("id",input.turnId).eq("role","user").single();
  if(turn.error||!turn.data)throw new RequestFailure("This saved user turn is unavailable.",404);
  const profile=await client.from("profiles").select("time_zone").eq("user_id",owner).single();
  if(profile.error||!profile.data)throw new RequestFailure("Your profile could not load.",503);
  const zone=TimeZoneSchema.parse(profile.data.time_zone),today=getLocalDate(new Date(turn.data.occurred_at).toISOString(),zone);
  const token=randomUUID();
  const claim=await client.rpc("claim_voice_turn",{p_turn:input.turnId,p_token:token,p_target:input.targetRootId});
  if(claim.error){
   // Database raise messages are fixed strings; they name the rule, never transcript text.
   console.error("[voice] Claim refused",JSON.stringify({code:claim.error.code,reason:claim.error.message?.slice(0,120)??null}));
   if(claim.error.code==="P0001")throw new RequestFailure(claimRefusalMessage(claim.error.message??""),409);
   throw new RequestFailure("Voice processing storage is unavailable. Apply migration 005.",503);
  }
  const claimed=z.object({state:z.enum(["ready","cached","busy"]),job:z.unknown().optional()}).parse(claim.data);
  if(claimed.state==="busy")throw new RequestFailure("This turn is still processing. Wait briefly, then retry.",409);
  const job=claimed.job as Row<"voice_turn_runs">;
  if(job.user_id!==owner||job.turn_id!==input.turnId)throw new Error("Voice ownership mismatch");
  if(claimed.state==="cached"){
   let saved=VoiceOutcomeSchema.parse(job.result);
   if(saved.questions){const current=await readQuestionLoop(client,owner);if(current.revision!==saved.questions.revision){const {questions:old,...rest}=saved;void old;saved={...rest,reply:"This is a previous question receipt. Open Evidence for the current question and refreshed evidence."};}}
   const state=saved.investigation?await readFeatureGeneration(featureWriter(),owner):null;
   return Response.json({outcome:state?freshInvestigationReceipt(saved,state):saved},{headers});
  }
  release=async()=>{await client.rpc("release_voice_turn",{p_turn:input.turnId,p_token:token});};
  let target:Row<"turn_extractions">|null=null;
  let targetTranscript:string|null=null;
  if(job.target_root_id){
   const t=await client.from("turn_extractions").select("*").eq("user_id",owner).eq("root_turn_id",job.target_root_id).eq("extractor_version","capture-v1").single();
   const raw=await client.from("conversation_turns").select("transcript").eq("user_id",owner).eq("id",job.target_root_id).single();
   if(t.error||!t.data||raw.error||!raw.data)throw new RequestFailure("The selected report is unavailable.",409);
   target=t.data;targetTranscript=raw.data.transcript;
  }
  const questions=await readQuestionLoop(client,owner);
  const activeQuestion=!job.target_root_id&&!questions.loop?.stopped?questions.loop?.question:null;
  let intent:z.infer<typeof VoiceIntentSchema>;
  try {intent=job.plan?VoiceIntentSchema.parse({unsupportedMetric:null,investigationOutcome:null,...(job.plan as object)}):await identifyVoiceIntent({transcript:job.transcript,anchorDate:today,activeQuestion,target:target?{transcript:targetTranscript,latest:target.result,accepted:target.accepted_result}:null});}
  catch{throw new RequestFailure("I could not understand this turn reliably. No new observations were confirmed. Retry processing.",502);}
  const targetStatus=(target?.result as {status?:string}|null)?.status;
  if(intent.kind==="followup"&&target&&targetStatus!=="needs_clarification"&&!correctionPhrase.test(job.transcript)){
   intent={...intent,kind:"report"};
  }
  if(!job.plan&&intent.kind==="investigate"){const explicit=explicitVoiceDate(job.transcript);if(explicit)intent={...intent,query:{...intent.query,kind:"date",from:explicit,to:null}};else if(explicit===null)throw new RequestFailure("Please give one valid investigation date as YYYY-MM-DD.",400);}
  if(!job.plan&&cancelPhrase.test(job.transcript.trim()))intent={...intent,kind:"cancel"};
  // Selection context does not contaminate command/date interpretation. The app routes meaningful reports/short replies after classification.
  if(!job.plan&&activeQuestion&&(intent.kind==="report"||intent.kind==="followup"&&!correctionPhrase.test(job.transcript)||shortQuestionAnswer(job.transcript)))intent={...intent,kind:"question_answer"};
  if(!job.plan&&(intent.kind==="question_answer"||intent.kind==="cancel")&&activeQuestion&&questions.loop)intent={...intent,questionContext:{loopId:questions.loop.id,key:activeQuestion.key}};
  if(!job.plan){
   const planned=await client.rpc("plan_voice_turn",{p_turn:input.turnId,p_token:token,p_plan:intent as unknown as Json});
   if(planned.error)throw new RequestFailure("Processing could not be prepared. No new observations were confirmed. Retry.",503);
   intent=VoiceIntentSchema.parse(planned.data);
  }
  // A bare cancel phrase never becomes a correction, even when the selected report is complete; it would otherwise be extracted as "none".
  if(cancelPhrase.test(job.transcript.trim()))intent={...intent,kind:"cancel"};
  // A selected report that still awaits clarification makes a spoken report its answer; the model's report/followup split is not authority here.
  if(intent.kind==="report"&&(target?.result as {status?:string}|null)?.status==="needs_clarification")intent={...intent,kind:"followup"};
  const pl=intent.language==="pl";
  const outcome:VoiceOutcome={turnId:input.turnId,disposition:"conversation",reply:null,capture:null,targetRootId:job.target_root_id,retrieval:null};
  // Retrieval of an untracked measurement must never fall back to other types.
  const untrackedMetric=intent.kind==="retrieve"||intent.kind==="unsupported"?(intent.unsupportedMetric??(intent.kind==="retrieve"?untrackedMetricName(job.transcript):null)):null;
  if(intent.kind==="noise"){outcome.disposition="ignore";}
  else if(untrackedMetric){outcome.reply=unsupportedMetricReply(untrackedMetric,intent.language);}
  else if(intent.kind==="question_answer"){
   outcome.questionAnswer=true;
   const replay=await processedQuestionTurn(client,owner,input.turnId);
   if(!replay&&(!intent.questionContext||intent.questionContext.loopId!==questions.loop?.id||intent.questionContext.key!==activeQuestion?.key))throw new RequestFailure("The question for this saved answer has changed. Open Evidence for the current question.",409);
   if(!replay&&(!activeQuestion||!questions.loop))throw new RequestFailure("There is no active question. Start an investigation first.",409);
   const state=await questionAction(client,owner,{action:"answer",revision:questions.revision,answerId:followupId(input.turnId),text:job.transcript},{id:input.turnId,at:new Date(turn.data.occurred_at).toISOString(),text:job.transcript});
   outcome.questions=state;outcome.targetRootId=null;
   if(state.fresh&&state.loop)outcome.investigation=state.loop.current;
   const comparison=state.fresh&&state.loop?compareEvidence(state.loop.before.bundle,state.loop.current.bundle):null;
   outcome.reply=(state.loop?.feedback??"The question remains unanswered.")
    +(comparison?comparison.historicalChanged?" Historical calculations changed; compare the counts and effects in Evidence.":" Historical association strength, effects and sample sizes are unchanged.":"")
    +(state.loop?.pending?" Retry the pending answer in Evidence.":state.fresh&&state.loop?.question?` ${state.loop.question.key===activeQuestion?.key?"Question still open":"Next question"}: ${state.loop.question.text}`:state.fresh?" No further answerable question remains.":" Refresh evidence to recover the confirmed state.");
  }
  else if(intent.kind==="cancel"&&activeQuestion){
   const context=intent.questionContext;
   if(!context||context.loopId!==questions.loop?.id||context.key!==activeQuestion.key){
    outcome.questions=questions;outcome.targetRootId=null;outcome.reply="That saved question action is no longer current. Open Evidence for the selected question.";
   }else{
   const stop=/^\W*(stop|stop questions|end|koniec)\W*$/iu.test(job.transcript);
   const state=await questionAction(client,owner,{action:stop?"stop":"skip",revision:questions.revision});
   outcome.questions=state;outcome.targetRootId=null;outcome.reply=(state.loop?.feedback??"Question skipped.")+(state.loop?.question?` Next question: ${state.loop.question.text}`:" No further question remains.");
   }
  }
  else if(intent.kind==="cancel"){outcome.disposition="cancel";outcome.targetRootId=null;outcome.reply=pl?"Przerwano wyjaśnianie. Poprzednie zapisy pozostają bez zmian.":"Clarification cancelled. Existing saved reports remain unchanged.";}
  else if(intent.kind==="report"||intent.kind==="followup"){
   if(intent.kind==="followup"&&!target){outcome.reply=pl?"Wybierz kartę obserwacji przyciskiem do odpowiedzi głosowej, a potem powtórz poprawkę.":"Select the observation card for a voice follow-up, then repeat your clarification or correction.";}
   else {
    if(intent.kind==="followup"&&job.transcript.length>2000)throw new RequestFailure("The correction is too long. Use a shorter follow-up or the card's form.",400);
    const root=intent.kind==="followup"?target!.root_turn_id:input.turnId;
    const response=await captureTurn(new Request(request.url,{method:"POST",headers:{Authorization:request.headers.get("authorization")!,"Content-Type":"application/json"},body:JSON.stringify({turnId:root,...(intent.kind==="followup"?{followup:{id:followupId(input.turnId),text:job.transcript,revision:job.target_revision}}:{})})}));
    const body=await response.json();
    if(!response.ok)throw new RequestFailure(body.error??"Capture failed. No new observations were confirmed.",response.status);
    outcome.capture=CaptureRecordSchema.parse(body.record);outcome.disposition=intent.kind==="followup"?"followup":"capture";
    outcome.targetRootId=root;outcome.reply=captureFeedback(outcome.capture,intent.language,intent.kind==="followup");
   }
  } else if(intent.kind==="investigate"){
   const q=intent.query;
   const date=q.kind==="yesterday"?addCalendarDays(today,-1):q.kind==="date"?q.from:q.kind==="today"||q.kind==="unspecified"?today:null;
   if(!intent.investigationOutcome||!date||q.kind==="range"){
    outcome.reply=pl?"Wybierz energie, HRV albo dlugosc snu oraz jeden dzien.":"Choose energy, HRV or sleep duration and a single day to investigate.";
   }else{
    const questionState=await questionAction(client,owner,{action:"start",revision:questions.revision,input:{mode:"investigate",outcome:intent.investigationOutcome,date,scope:q.includeDemo?"demo":"personal",language:intent.language}});
    const result=questionState.loop!.current;outcome.questions=questionState;
    outcome.disposition="conversation";outcome.investigation=result;outcome.targetRootId=null;
    outcome.reply=result.explanation.summary+(questionState.loop?.question?` One missing-context question: ${questionState.loop.question.text}`:" No useful answerable context question remains.");
   }
  } else if(intent.kind==="retrieve"){
   const q=intent.query;
   let from:string|null=null,to:string|null=null;
   if(q.kind==="today"||q.kind==="yesterday"){from=q.kind==="today"?today:addCalendarDays(today,-1);to=from;}
   else if(q.kind==="date"){from=q.from;to=q.from;}
   else if(q.kind==="range"){from=q.from;to=q.to;}
   if(!from||!to||from>to||to>today||Math.round((Date.parse(to)-Date.parse(from))/86400000)>6){outcome.reply=pl?"Podaj dzień lub zakres do siedmiu dni, na przykład wczoraj.":"Which day, or range of up to seven days, should I look up? For example, yesterday.";}
   else{
    let query=client.from("subjective_events").select("*",{count:"exact"}).eq("user_id",owner)
     .gte("observed_at",`${addCalendarDays(from,-1)}T00:00:00Z`).lt("observed_at",`${addCalendarDays(to,2)}T00:00:00Z`)
     .order("observed_at").order("id").limit(1000);
    if(q.type)query=query.eq("event_type",q.type);
    if(!q.includeDemo)query=query.not("id","like","demo:%");
    const rows=await query;if(rows.error)throw new RequestFailure("Saved reports could not load. Try again.",503);
    const matching=(rows.data??[]).map(row=>parseEventRow(row,owner)).filter(e=>{const day=getLocalDate(e.occurredAt,zone);return day>=from!&&day<=to!;});
    const complete=(rows.count??0)<=1000&&matching.length<=100;
    const events=matching.slice(0,100);
    outcome.disposition="retrieval";outcome.retrieval={from,to,timeZone:zone,events,complete,syntheticIncluded:q.includeDemo};
    const summary=events.slice(0,4).map(e=>`${getLocalDate(e.occurredAt,zone)}: ${observationText(e,intent.language)}`).join("; ");
    outcome.reply=events.length?(pl?"Zapisane obserwacje: ":"Saved reports: ")+summary+(events.length>4?(pl?". Pozostałe wyniki są poniżej.":". The remaining results are shown below."):"."):(pl?"Nie znaleziono pasujących zapisów. To nie oznacza zgłoszenia braku objawów lub spożycia.":"I found no matching saved reports. That does not mean you reported an absence.");
    if(!complete)outcome.reply+=pl?" Wyniki są ograniczone; to nie jest pełna historia.":" Results are limited; this is not the complete history.";
    if(q.includeDemo)outcome.reply+=pl?" Uwzględniono dane demonstracyjne.":" Synthetic demo records were included.";
   }
  } else if(intent.kind==="capabilities"){
   outcome.reply=pl?"Mogę zapisywać i odczytywać energię, stres, nastrój, bolesność mięśni, wysiłek treningowy, alkohol, kofeinę, późne posiłki, objawy choroby i ból. Oceny są od zera do dziesięciu. Możesz powiedzieć: wypiłem kawę, albo zapytać o wczorajsze zapisy. Moge tez badac energie, HRV i dlugosc snu na podstawie zapisanej historii, bez ustalania przyczyn.":"I can record and retrieve energy, stress, mood, soreness, workout effort, alcohol, caffeine, late meals, illness symptoms, and pain. Ratings use zero to ten. Try: I drank coffee, or: what did I record yesterday? I can also investigate recorded energy, HRV and sleep duration using historical associations, with uncertainty. Try: investigate my energy today.";
  } else if(intent.kind==="greeting"){outcome.reply=pl?"Słucham. Możesz podać obserwację lub zapytać o zapisane dane.":"I'm listening. You can report an observation or ask about saved reports.";}
  else if(intent.kind==="unclear"){outcome.reply=pl?"Nie zrozumiałem tej wypowiedzi. Powtórz ją proszę; nie zapisano nowych obserwacji.":"I didn't understand that. Please repeat it; no new observations were saved.";}
  else{outcome.reply=pl?"Mogę pomóc zapisywać i odczytywać obsługiwane obserwacje. Nie mam jeszcze danych do analizy przyczyn ani diagnozy.":"I can help record and retrieve supported observations. I can investigate energy, HRV and sleep duration using recorded evidence. I cannot diagnose or establish a cause.";}
  const validated=VoiceOutcomeSchema.parse(outcome);
  const saved=await client.rpc("finish_voice_turn",{p_turn:input.turnId,p_token:token,p_result:validated as unknown as Json});
  if(saved.error)throw new RequestFailure("The processing receipt was not confirmed. Retry to recover the result.",503);
  release=null;
  return Response.json({outcome:VoiceOutcomeSchema.parse(saved.data)},{headers});
 }catch(error){
  if(release){try{await release();}catch{/* Lease expiry permits recovery. */}}
  return Response.json({error:error instanceof RequestFailure?error.message:error instanceof z.ZodError?"Invalid voice request or result.":"Voice processing did not complete. Open Evidence or Timeline to recover the confirmed state before retrying."},{status:error instanceof RequestFailure?error.status:error instanceof z.ZodError?400:503,headers});
 }
}

export async function GET(request:Request){
 try{
  const {client,owner}=await authenticatedDatabase(request);
  const conversationId=VoiceTurnInputSchema.shape.turnId.parse(new URL(request.url).searchParams.get("conversationId"));
  const turns=await client.from("conversation_turns").select("id").eq("user_id",owner).eq("conversation_id",conversationId).eq("role","user").limit(500);
  if(turns.error)throw new RequestFailure("Voice history could not load.",503);
  if(!turns.data.length)return Response.json({runs:[]},{headers});
  const runs=await client.from("voice_turn_runs").select("turn_id,target_root_id,result").eq("user_id",owner).in("turn_id",turns.data.map(t=>t.id));
  if(runs.error)throw new RequestFailure("Voice history is unavailable. Apply migration 005.",503);
  const parsed=runs.data.map(j=>({turnId:j.turn_id,targetRootId:j.target_root_id,outcome:j.result?VoiceOutcomeSchema.parse(j.result):null}));
  if(parsed.some(run=>run.outcome?.investigation)){
   const state=await readFeatureGeneration(featureWriter(),owner);
   for(const run of parsed)if(run.outcome)run.outcome=freshInvestigationReceipt(run.outcome,state);
  }
  if(parsed.some(run=>run.outcome?.questions)){const current=await readQuestionLoop(client,owner);for(const run of parsed)if(run.outcome?.questions&&run.outcome.questions.revision!==current.revision){const {questions:old,...rest}=run.outcome;void old;run.outcome={...rest,reply:"Previous question receipt. Open Evidence for the current question."};}}
  return Response.json({runs:parsed},{headers});
 }catch(error){return Response.json({error:error instanceof RequestFailure?error.message:"Voice history could not load."},{status:error instanceof RequestFailure?error.status:400,headers});}
}
