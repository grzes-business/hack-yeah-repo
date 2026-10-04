import test from "node:test";
import assert from "node:assert/strict";
import { VoiceTurnInputSchema, VoiceOutcomeSchema, VoiceIntentSchema } from "./controller-contracts";
import { captureFeedback } from "./feedback";
import { canonicalizeExtraction } from "../capture/canonicalize";
import { CandidateSchema } from "../capture/contracts";
const now="2026-10-03T08:00:00.000Z";
const candidate={type:"soreness",rating:null,consumed:null,quantity:null,beverage:null,amountMg:null,present:null,location:null,intensity:null,booleanValue:null,timing:{kind:"now",date:null,daysAgo:null,clock:null}};
test("voice contracts reject caller-selected owners and unsupported actions",()=>{
 assert.deepEqual(VoiceTurnInputSchema.parse({turnId:"turn"}),{turnId:"turn",targetRootId:null,context:{mode:"report"},scope:"personal"});
 assert.throws(()=>VoiceTurnInputSchema.parse({turnId:"turn",userId:"other"}));
 assert.throws(()=>VoiceIntentSchema.parse({kind:"diagnose",language:"en",query:{kind:"today",from:null,to:null,type:null,includeDemo:false}}));
 assert.throws(()=>VoiceOutcomeSchema.parse({turnId:"turn",disposition:"capture",reply:"Saved",capture:{},targetRootId:null,retrieval:null}));
});
test("missing soreness rating yields clarification and no partial coffee capture",()=>{
 const coffee={...candidate,type:"caffeine",consumed:true};
 const out=canonicalizeExtraction({status:"captured",events:[coffee,candidate],eventTypes:[],reason:null},{rootTurnId:"root",sourceTurnId:"root",anchorAt:now,capturedAt:now,timeZone:"Europe/Warsaw"});
 assert.equal(out.status,"needs_clarification");assert.ok(!("events" in out));
 assert.throws(()=>CandidateSchema.parse({...coffee,beverage:"coffee"}));
 assert.throws(()=>CandidateSchema.parse({...candidate,present:true,location:"legs"}));
});
test("feedback confirms only committed outcomes and preserves correction uncertainty",()=>{
 assert.equal(captureFeedback({rootTurnId:"root",sourceTurnId:"root",revision:0,result:null,acceptedResult:null,pending:true},"en",false),"Saving is not confirmed yet.");
 const event={id:"event",type:"caffeine" as const,value:{consumed:true,amountMg:null},occurredAt:now,capturedAt:now,timeZone:"Europe/Warsaw",conversationTurnId:"root",extractionConfidence:null};
 const accepted={status:"captured" as const,events:[event]};
 const card={rootTurnId:"root",sourceTurnId:"root",revision:1,result:accepted,acceptedResult:accepted,pending:false};
 assert.match(captureFeedback(card,"en",false),/Saved: Caffeine: Caffeine reported; dose unknown/);
 assert.match(captureFeedback({...card,result:{status:"needs_clarification",eventTypes:["soreness"],reason:"What rating?"}},"en",true),/earlier saved observations remain unchanged/);
});

test("voice context is explicit and cannot forge owner, source or morning dimensions",()=>{
 assert.throws(()=>VoiceTurnInputSchema.parse({turnId:"t",context:{mode:"morning_checkin",date:"2026-10-04",dimension:"hrv"}}));
 assert.throws(()=>VoiceTurnInputSchema.parse({turnId:"t",context:{mode:"report",scope:"demo"}}));
 assert.throws(()=>VoiceTurnInputSchema.parse({turnId:"t",context:{mode:"investigate",loopId:"other",key:"q"}}));
 assert.equal(VoiceTurnInputSchema.parse({turnId:"t",context:{mode:"morning_checkin",date:"2026-10-04",dimension:"energy"}}).context.mode,"morning_checkin");
});
