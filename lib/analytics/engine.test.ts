import test from "node:test";
import assert from "node:assert/strict";
import { addCalendarDays } from "../domain";
import { calculateAnalytics, median, spearman } from "./engine";
import { rebuildDailyFeatures } from "../features/builder";
import { MockHealthDataSource } from "../health/mock-data-source";
import { DemoOptionsSchema, demoRange } from "../demo/scenario";
import { createSubjectiveFixtures } from "../demo/subjective-fixtures";
import { emptyHistory, setKnown, date, computedAt, version } from "./test-helpers";
test("median and average-rank Spearman match hand references, including ties and constants",()=>{
 assert.equal(median([9,1,2,4]),3);assert.equal(median([]),null);
 assert.equal(spearman([1,2,3],[3,2,1]),-1);assert.equal(spearman([1,1,1],[1,2,3]),null);
 assert.ok(Math.abs(spearman([1,1,2,3],[1,2,3,4])!-Math.sqrt(0.9))<1e-12);
});
test("baseline excludes selected day, preserves zero MAD and classifies only eligible deviations",()=>{
 const rows=emptyHistory();rows.forEach((row,index)=>setKnown(row,"hrv",index===43?100:40+(index%3)*10));
 const report=calculateAnalytics(rows,date,computedAt,version),baseline=report.baselines.find(b=>b.feature==="hrv")!;
 assert.equal(baseline.sampleSize,14);assert.equal(baseline.median,50);assert.equal(baseline.mad,10);assert.equal(baseline.robustZ,3.3725);
 assert.equal(report.anomalies.find(a=>a.metric==="hrv")?.classification,"unusually_high");
 rows.forEach(row=>setKnown(row,"hrv",0));const constant=calculateAnalytics(rows,date,computedAt,version);
 assert.equal(constant.baselines.find(b=>b.feature==="hrv")?.robustZ,null);assert.equal(constant.baselines.find(b=>b.feature==="hrv")?.relativeDifference,null);assert.equal(constant.anomalies.length,0);
});
test("exact lag-one exposure grouping and chronological consistency use eligible dates",()=>{
 const rows=emptyHistory();rows.forEach((row,index)=>{setKnown(row,"alcohol",index%2===0);setKnown(row,"hrv",(index-1)%2===0?40:60);});
 const result=calculateAnalytics(rows,date,computedAt,version).relationships.find(r=>r.relationshipId==="alcohol__hrv")!;
 assert.equal(result.sampleSize,42);assert.equal(result.evidence,"CONSISTENT_ASSOCIATION");
 assert.equal(result.effect?.kind,"exposure");if(result.effect?.kind!=="exposure")throw new Error("Exposure expected");
 assert.equal(result.effect.exposedCount,21);assert.equal(result.effect.controlCount,21);assert.equal(result.effect.medianDifference,-20);assert.equal(result.effect.relativeDifference,-1/3);
 rows[0].features.alcohol={status:"unknown",reason:"not_observed"};
 assert.equal(calculateAnalytics(rows,date,computedAt,version).relationships.find(r=>r.relationshipId==="alcohol__hrv")?.sampleSize,41);
});
test("unknown/sparse history and constant continuous values never invent effects",()=>{
 const rows=emptyHistory();assert.ok(calculateAnalytics(rows,date,computedAt,version).relationships.every(r=>r.status==="insufficient_data"&&r.effect===null));
 rows.forEach(row=>{setKnown(row,"sleep_duration",400);setKnown(row,"energy",6);});
 const result=calculateAnalytics(rows,date,computedAt,version).relationships.find(r=>r.relationshipId==="sleep_duration__energy")!;
 assert.equal(result.sampleSize,42);assert.equal(result.status,"insufficient_data");assert.equal(result.effect,null);
});
test("fractional step baselines validate and identical history reproduces numerical results",()=>{
 const rows=emptyHistory();rows.forEach((row,index)=>setKnown(row,"steps",index===43?100:10+(index%4)));
 const report=calculateAnalytics(rows,date,computedAt,version);
 assert.equal(report.baselines.find(b=>b.feature==="steps")?.median,11.5);assert.equal(report.anomalies.find(a=>a.metric==="steps")?.baseline,11.5);
 assert.deepEqual(calculateAnalytics(rows,date,computedAt,version),report);
 assert.throws(()=>calculateAnalytics(rows.slice(1),date,computedAt,version));
});
test("seeded fixture recovers declared sleep, stress and alcohol directions without recipe access",async()=>{
 const options=DemoOptionsSchema.parse({endDate:"2026-10-03",timeZone:"Europe/Warsaw"}),range=demoRange(options);
 const source=new MockHealthDataSource(options),metrics=await source.getSamples({...range,metrics:["hrv","resting_hr","sleep_duration","sleep_start","sleep_end","steps","active_energy","workout_duration","workout_avg_hr"]});
 const rows=rebuildDailyFeatures(addCalendarDays(date,-43),date,{userId:"owner",timeZone:options.timeZone,builtAt:computedAt,scope:"demo",metrics,events:createSubjectiveFixtures(options).events});
 const report=calculateAnalytics(rows,date,computedAt,"analytics-v1:daily-v1:demo");
 const sleep=report.relationships.find(r=>r.relationshipId==="sleep_duration__energy")!,stress=report.relationships.find(r=>r.relationshipId==="stress__sleep_duration")!,alcohol=report.relationships.find(r=>r.relationshipId==="alcohol__hrv")!;
 assert.ok(sleep.effect?.kind==="spearman"&&sleep.effect.rho>0);assert.ok(stress.effect?.kind==="spearman"&&stress.effect.rho<0);assert.ok(alcohol.effect?.kind==="exposure"&&alcohol.effect.medianDifference<0);
});
