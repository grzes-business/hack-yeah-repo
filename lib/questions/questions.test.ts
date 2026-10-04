import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays, EvidenceBundleSchema, getLocalDate } from "../domain";
import { emptyHistory, setKnown, date, computedAt, version } from "../analytics/test-helpers";
import { calculateAnalytics } from "../analytics/engine";
import { AnalyticsReportSchema } from "../analytics/contracts";
import { buildEvidenceBundle } from "../investigation/bundle";
import { canonicalizeExtraction } from "../capture/canonicalize";
import { selectBestQuestion, compareEvidence , spokenDate} from "./select";
import { QuestionActionSchema } from "./contracts";
function bundle(outcome:"hrv"|"energy"|"sleep_duration"="hrv"){
 const rows=emptyHistory(),calculated=calculateAnalytics(rows,date,computedAt,version);
 return buildEvidenceBundle(AnalyticsReportSchema.parse({userId:"owner",date,timeZone:"Europe/Warsaw",scope:"personal",inputGeneration:"4",analysisVersion:version,computedAt,...calculated,limitations:[]}),outcome,rows.slice(-2));
}
test("deterministic direct factors precede confounders with registered lags and anchored questions",()=>{
 for(const outcome of ["hrv","energy","sleep_duration"] as const){
  const value=bundle(outcome),first=selectBestQuestion(value)!;
  assert.equal(first.date,addCalendarDays(date,-1));
  assert.equal(first.feature,outcome==="hrv"?"alcohol":outcome==="energy"?"workout_rpe":"stress");
  assert.deepEqual(selectBestQuestion(value),first);assert.ok(first.text.includes(spokenDate(first.date)));
  assert.ok(!selectBestQuestion(value,[first.key])||selectBestQuestion(value,[first.key])!.key!==first.key);
 }
});
test("known false, skipped, unavailable, ambiguous, and objective gaps never become questions",()=>{
 const value=bundle();setKnown(value.contextDays[0],"alcohol",false);
 value.missingPotentialFactors=value.missingPotentialFactors.filter(ref=>ref.feature!=="alcohol");
 value.contextDays[0].features.workout_rpe={status:"unknown",reason:"not_available"};
 value.dailyFeatures.features.illness={status:"unknown",reason:"ambiguous"};
 assert.equal(selectBestQuestion(value),null);
 const empty=bundle();assert.equal(selectBestQuestion(empty,empty.missingPotentialFactors.map(ref=>`${ref.feature}:${ref.date}`)),null);
});
test("missing-factor tampering and owner-inconsistent bundles are rejected before selection",()=>{
 const value=bundle();assert.throws(()=>selectBestQuestion({...value,missingPotentialFactors:[{feature:"mood",date}]}));
 assert.equal(EvidenceBundleSchema.safeParse({...value,contextDays:[{...value.contextDays[0],userId:"other"}]}).success,false);
});
test("context-only answers update actual dated values without upgrading historical evidence",()=>{
 const before=bundle(),after=structuredClone(before);setKnown(after.contextDays[0],"alcohol",false);
 after.missingPotentialFactors=after.missingPotentialFactors.filter(ref=>ref.feature!=="alcohol");
 const comparison=compareEvidence(before,after);assert.equal(comparison.historicalChanged,false);assert.equal(comparison.changes.length,1);
 assert.deepEqual(comparison.changes[0].after,{status:"known",value:false});assert.equal(comparison.changes[0].date,addCalendarDays(date,-1));
 assert.deepEqual(compareEvidence(before,structuredClone(before)),{changes:[],historicalChanged:false});
 assert.throws(()=>compareEvidence(before,{...after,outcome:"energy"}));
});
test("public action contracts prohibit owner, model target overrides and arbitrary captures",()=>{
 for(const extra of [{owner:"other"},{feature:"mood"},{date},{events:[]},{turnId:"forged"}])assert.equal(QuestionActionSchema.safeParse({action:"answer",revision:1,answerId:"00000000-0000-4000-8000-000000000000",text:"no",...extra}).success,false);
});
test("canonical dated negative is false with source provenance; incomplete ratings are all-or-clarify",()=>{
 const candidate={type:"alcohol",rating:null,consumed:false,quantity:0,beverage:null,amountMg:null,present:null,location:null,intensity:null,booleanValue:null,timing:{kind:"date",date:addCalendarDays(date,-1),daysAgo:null,clock:null}};
 const context={rootTurnId:"answer",sourceTurnId:"answer",anchorAt:computedAt,capturedAt:computedAt,timeZone:"Europe/Warsaw",sourceText:"Question: did you drink alcohol? Answer: no"};
 const result=canonicalizeExtraction({status:"captured",events:[candidate],eventTypes:[],reason:null},context);
 assert.equal(result.status,"captured");if(result.status!=="captured")return;
 assert.equal(result.events[0].conversationTurnId,"answer");assert.equal(getLocalDate(result.events[0].occurredAt,context.timeZone),addCalendarDays(date,-1));
 assert.deepEqual(result.events[0].value,{consumed:false,quantity:0,unit:"reported_drinks"});
 const unclear=canonicalizeExtraction({status:"needs_clarification",events:[],eventTypes:["stress"],reason:"Which rating?"},context);assert.equal(unclear.status,"needs_clarification");assert.ok(!("events" in unclear));
});

import { guardQuestionAnswer } from "./answer";
test("uncertainty, a numeric no and unrelated full reports cannot fill the selected variable",()=>{
 const question=selectBestQuestion(bundle())!;
 const forged={status:"captured" as const,events:[{id:"capture:v1:x",type:"alcohol" as const,value:{consumed:false,quantity:0,unit:"reported_drinks" as const},occurredAt:computedAt,capturedAt:computedAt,timeZone:"Europe/Warsaw",conversationTurnId:"turn",extractionConfidence:null}]};
 assert.equal(guardQuestionAnswer(forged,question,"I don't know.").status,"nothing_trackable");
 assert.equal(guardQuestionAnswer(forged,question,"My mood is five out of ten.").status,"nothing_trackable");
 assert.equal(guardQuestionAnswer(forged,question,"No.").status,"captured");
 assert.equal(guardQuestionAnswer(forged,question,"Nine.").status,"needs_clarification");
 const rpe={...question,feature:"workout_rpe" as const},numeric={...forged,events:[{...forged.events[0],type:"workout_rpe" as const,value:0}]};
 assert.equal(guardQuestionAnswer(numeric,rpe,"No.").status,"needs_clarification");
 assert.equal(guardQuestionAnswer(numeric,rpe,"I did not train.").status,"nothing_trackable");
});

import { explicitVoiceDate } from "./voice-context";
test("explicit spoken investigation dates survive model date omissions without guessing",()=>{
 assert.equal(explicitVoiceDate("Investigate the synthetic demo HRV for October third, 2026."),"2026-10-03");
 assert.equal(explicitVoiceDate("Investigate HRV for September twentieth, 2026."),"2026-09-20");
 assert.equal(explicitVoiceDate("for September twenty-first 2026"),"2026-09-21");
 assert.equal(explicitVoiceDate("for 2026-10-03"),"2026-10-03");
 assert.equal(explicitVoiceDate("for 2026-02-30"),null);
 assert.equal(explicitVoiceDate("between 2026-10-01 and 2026-10-03"),null);
 assert.equal(explicitVoiceDate("today"),undefined);
 assert.equal(explicitVoiceDate("October third"),undefined);
});
