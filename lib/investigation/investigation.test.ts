import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays, EvidenceBundleSchema, OutcomeSchema } from "../domain";
import { AnalyticsReportSchema } from "../analytics/contracts";
import { calculateAnalytics } from "../analytics/engine";
import { emptyHistory, setKnown, date, computedAt, version } from "../analytics/test-helpers";
import { buildEvidenceBundle } from "./bundle";
import { InvestigationInputSchema } from "./contracts";
import { evidenceFacts, orderEvidenceFacts } from "./facts";
import { explainEvidence } from "./explain";
import { freshInvestigationReceipt } from "./receipt";
import { VoiceIntentSchema } from "../conversation/controller-contracts";
function fixture(known=true){
 const rows=emptyHistory();if(known)rows.forEach((row,index)=>{setKnown(row,"energy",index%2?5:7);setKnown(row,"sleep_duration",index%2?360:420);setKnown(row,"hrv",index%2?40:60);setKnown(row,"alcohol",index%2===0);});
 const calculated=calculateAnalytics(rows,date,computedAt,version);
 const report=AnalyticsReportSchema.parse({userId:"owner",date,timeZone:"Europe/Warsaw",scope:"personal",inputGeneration:"4",analysisVersion:version,computedAt,...calculated,limitations:["Recorded history; no causality."]});
 return {report,context:rows.filter(row=>row.date===addCalendarDays(date,-1))};
}
test("tool inputs reject owners, unsupported outcomes, modes and forged bundles",()=>{
 for(const fields of [{userId:"another"},{outcome:"weight"},{mode:"doctor_prep"},{bundle:{}}])assert.equal(InvestigationInputSchema.safeParse({outcome:"hrv",date,...fields}).success,false);
 assert.equal(InvestigationInputSchema.parse({outcome:"energy",date}).mode,"investigate");
});
test("all allowed outcomes produce correctly dated owned bundles with only registered edges",()=>{
 const {report,context}=fixture();
 for(const outcome of OutcomeSchema.options){
  const bundle=buildEvidenceBundle(report,outcome,context);assert.ok(EvidenceBundleSchema.safeParse(bundle).success);
  assert.equal(bundle.dailyFeatures.date,date);assert.equal(bundle.contextDays[0].date,addCalendarDays(date,-1));
  assert.ok(bundle.relationships.every(result=>result.analysisVersion===version&&result.userId==="owner"));
 }
 const hrv=buildEvidenceBundle(report,"hrv",context);
 assert.ok(hrv.missingPotentialFactors.some(ref=>ref.feature==="workout_rpe"&&ref.date===addCalendarDays(date,-1)));
 assert.ok(!hrv.missingPotentialFactors.some(ref=>ref.feature==="alcohol"));
 assert.throws(()=>buildEvidenceBundle({...report,userId:"other"},"hrv",context));
 assert.throws(()=>buildEvidenceBundle(report,"hrv",[{...context[0],timeZone:"UTC"}]));
 assert.throws(()=>buildEvidenceBundle(report,"hrv",[]));
});
test("unknown current outcomes and sparse history stay explicit without anomalies or effects",()=>{
 const {report,context}=fixture(false),bundle=buildEvidenceBundle(report,"hrv",context);
 assert.equal(bundle.dailyFeatures.features.hrv.status,"unknown");assert.equal(bundle.currentAnomalies.length,0);
 assert.ok(bundle.relationships.every(result=>result.effect===null&&result.evidence==="INSUFFICIENT_DATA"));
 assert.ok(bundle.missingPotentialFactors.some(ref=>ref.feature==="alcohol"&&ref.date===addCalendarDays(date,-1)));
 const facts=evidenceFacts(bundle,"personal","en");assert.match(facts.find(f=>f.id==="current")!.text,/unknown/);assert.ok(facts.every(f=>f.paths.length));
});
test("fixed explanation corpus contains only rendered facts; unsupported claims/duplicates/omissions are rejected",()=>{
 for(const known of [true,false])for(const outcome of OutcomeSchema.options){
  const {report,context}=fixture(known),bundle=buildEvidenceBundle(report,outcome,context),facts=evidenceFacts(bundle,"personal","en");
  assert.deepEqual(orderEvidenceFacts(facts,{order:facts.map(f=>f.id)}),facts);
  assert.throws(()=>orderEvidenceFacts(facts,{order:[...facts.map(f=>f.id),"HRV is 999 and alcohol caused it"]}));
  assert.throws(()=>orderEvidenceFacts(facts,{order:facts.map(()=>facts[0].id)}));
  assert.throws(()=>orderEvidenceFacts(facts,{order:facts.slice(1).map(f=>f.id)}));
  assert.throws(()=>orderEvidenceFacts(facts,{order:facts.map(f=>f.id).reverse()}));
  assert.throws(()=>orderEvidenceFacts(facts,{order:facts.map(f=>f.id),diagnosis:"infection"}));
  assert.match(facts.find(f=>f.id==="limits")!.text,/do not establish what caused/);
 }
});
test("provider failure/invalid plans preserve identical facts and deterministic fallback",async()=>{
 const {report,context}=fixture(),bundle=buildEvidenceBundle(report,"hrv",context);
 const failed=await explainEvidence(bundle,"personal","en",async()=>{throw new Error("offline");});
 assert.equal(failed.source,"deterministic_fallback");assert.equal(failed.fallbackReason,"provider_unavailable");
 const invalid=await explainEvidence(bundle,"personal","en",async()=>({order:["invented"]}));
 assert.equal(invalid.fallbackReason,"invalid_plan");assert.deepEqual(failed.facts,invalid.facts);
 const success=await explainEvidence(bundle,"personal","en",async facts=>({order:facts.map(f=>f.id)}));
 assert.equal(success.source,"model_ordered");assert.equal(success.summary,success.facts.map(f=>f.text).join(" "));
});
test("cached voice investigations cannot replay as current after generation/zone changes",async()=>{
 const {report,context}=fixture(),bundle=buildEvidenceBundle(report,"hrv",context),explanation=await explainEvidence(bundle,"personal","en",async()=>{throw new Error("offline");});
 const receipt={turnId:"turn",disposition:"conversation" as const,reply:explanation.summary,capture:null,targetRootId:null,retrieval:null,investigation:{mode:"investigate" as const,scope:"personal" as const,inputGeneration:"4",bundle,explanation}};
 assert.equal(freshInvestigationReceipt(receipt,{generation:"4",timeZone:"Europe/Warsaw"}),receipt);
 for(const state of [{generation:"5",timeZone:"Europe/Warsaw"},{generation:"4",timeZone:"UTC"}]){
  const stale=freshInvestigationReceipt(receipt,state);assert.equal(stale.investigation,undefined);assert.match(stale.reply!,/no longer current/);
 }
 assert.equal(VoiceIntentSchema.safeParse({kind:"investigate",language:"en",investigationOutcome:"energy",unsupportedMetric:null,query:{kind:"today",from:null,to:null,type:null,includeDemo:false}}).success,true);
});
