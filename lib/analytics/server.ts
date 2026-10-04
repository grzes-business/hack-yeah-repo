import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addCalendarDays, getLocalDate, RelationshipResultSchema } from "../domain";
import { featureWriter, readFeatureGeneration, readOwnedDailyFeatures, rebuildOwnedDailyFeatures } from "../features/server";
import { builderVersion, type FeatureScope } from "../features/contracts";
import { RequestFailure } from "../db/server";
import type { Database, Json } from "../db/database.types";
import { calculateAnalytics, POLICY } from "./engine";
import { AnalyticsReportSchema, analysisVersion } from "./contracts";
type Input={date:string;scope:FeatureScope};
export async function ownedAnalytics(client:SupabaseClient<Database>,owner:string,input:Input,rebuild:boolean){
 const writer=featureWriter(),version=analysisVersion(input.scope);
 const range={from:addCalendarDays(input.date,-POLICY.relationshipDays-1),to:input.date,scope:input.scope};
 for(let attempt=0;attempt<3;attempt++){
  const before=await readFeatureGeneration(writer,owner);
  if(input.date>getLocalDate(new Date().toISOString(),before.timeZone))throw new RequestFailure("Choose today or a past local date.",400);
  const history=rebuild?await rebuildOwnedDailyFeatures(client,owner,range):await readOwnedDailyFeatures(client,owner,range);
  if("missingDates" in history&&history.missingDates.length)return {needsAnalysis:true,missingDates:history.missingDates};
  const state=await readFeatureGeneration(writer,owner);
  if(state.generation!==before.generation||state.timeZone!==before.timeZone)continue;
  const computedAt=new Date().toISOString();
  const calculated=calculateAnalytics(history.rows,input.date,computedAt,version);
  if(rebuild){
   const saved=await writer.rpc("commit_relationship_results",{p_owner:owner,p_generation:before.generation,p_zone:before.timeZone,p_builder:builderVersion(input.scope),p_rows:calculated.relationships as unknown as Json});
   if(saved.error?.code==="P0001")continue;
   if(saved.error||saved.data!==4)throw new RequestFailure("Analysis was not confirmed. Apply migration 009 and check the server writer.",503);
  }else{
   // Owner client + RLS and explicit metadata checks; never present stale privileged reads.
   const saved=await client.from("relationship_results").select("*").eq("user_id",owner).eq("time_zone",state.timeZone).eq("builder_version",builderVersion(input.scope)).eq("analysis_version",version).eq("period_from",addCalendarDays(input.date,-POLICY.relationshipDays)).eq("period_to",addCalendarDays(input.date,-1));
   if(saved.error)throw new RequestFailure("Analysis storage is unavailable. Apply migration 009.",503);
   if(saved.data.length!==4)return {needsAnalysis:true,missingDates:[]};
   calculated.relationships=saved.data.map(row=>{
    const result=RelationshipResultSchema.parse(row.payload);
    if(result.userId!==owner||result.relationshipId!==row.relationship_id||result.analysisVersion!==version||result.period.from!==row.period_from||result.period.to!==row.period_to||String(row.input_generation)!==state.generation)throw new Error("Analytical metadata mismatch");
    return result;
   }).sort((a,b)=>a.relationshipId.localeCompare(b.relationshipId));
  }
  const latest=await readFeatureGeneration(writer,owner);
  if(latest.generation!==before.generation||latest.timeZone!==before.timeZone)continue;
  return {needsAnalysis:false,report:AnalyticsReportSchema.parse({userId:owner,date:input.date,timeZone:state.timeZone,scope:input.scope,inputGeneration:state.generation,analysisVersion:version,computedAt,...calculated,limitations:["Historical windows exclude the selected day. Missing observations are excluded, never imputed.","These product thresholds are not clinically validated. No p-values, causal adjustment or medical advice are provided.",...(input.scope==="demo"?["Synthetic demonstration history; these results are not your health evidence."]:[])]})};
 }
 throw new RequestFailure("Observations changed during analysis. Retry after capture/import finishes.",409);
}
