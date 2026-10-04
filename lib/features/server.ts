import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DailyFeaturesSchema, Metrics, TimeZoneSchema, type DailyFeatures } from "../domain";
import { createIngestionRepository } from "../db/ingestion";
import { RequestFailure } from "../db/server";
import type { Database, Json } from "../db/database.types";
import { builderVersion, featureDates, inputEnvelope, type FeatureScope } from "./contracts";
import { rebuildDailyFeatures } from "./builder";
const GenerationSchema=z.strictObject({ generation:z.string().regex(/^[0-9]+$/),timeZone:TimeZoneSchema });
export function featureWriter() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new RequestFailure("Daily rebuilding needs the server Supabase writer configuration.",503);
 return createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function readFeatureGeneration(writer:SupabaseClient<Database>,owner:string){
 const result=await writer.rpc("read_feature_generation",{p_owner:owner});
 if(result.error)throw new RequestFailure("Daily storage is unavailable. Apply migration 007 and check the server writer configuration.",503);
 if(!result.data)throw new RequestFailure("Your profile is unavailable. Restore it before rebuilding.",409);
 return GenerationSchema.parse(result.data);
}
export async function rebuildOwnedDailyFeatures(client:SupabaseClient<Database>,owner:string,range:{from:string;to:string;scope:FeatureScope}){
 const writer=featureWriter(),repository=createIngestionRepository(client);
 for(let attempt=0;attempt<3;attempt++){
  const before=await readFeatureGeneration(writer,owner);
  const envelope=inputEnvelope(range.from,range.to);
  const [rawMetrics,rawEvents]=await Promise.all([
   repository.readMetricSamples({...envelope,metrics:Object.values(Metrics)}),repository.readSubjectiveEvents(envelope),
  ]);
  const after=await readFeatureGeneration(writer,owner);
  if(before.generation!==after.generation||before.timeZone!==after.timeZone)continue;
  const metrics=rawMetrics.filter(s=>range.scope==="demo"?s.source.type==="mock":s.source.type!=="mock");
  const events=rawEvents.filter(e=>range.scope==="demo"?e.id.startsWith("demo:"):!e.id.startsWith("demo:"));
  const rows=rebuildDailyFeatures(range.from,range.to,{userId:owner,timeZone:before.timeZone,builtAt:new Date().toISOString(),scope:range.scope,metrics,events});
  // Builder verifies every value and provenance before the privileged commit.
  const committed=await writer.rpc("commit_daily_features",{p_owner:owner,p_generation:before.generation,p_rows:rows as unknown as Json});
  if(committed.error?.code==="P0001")continue;
  if(committed.error||committed.data!==rows.length)throw new RequestFailure("Daily rows were not confirmed. Retry rebuilding.",503);
  const current=await readFeatureGeneration(writer,owner);
  if(current.generation!==before.generation||current.timeZone!==before.timeZone)continue;
  return {rows,inputGeneration:before.generation,timeZone:before.timeZone,builderVersion:builderVersion(range.scope),scope:range.scope};
 }
 throw new RequestFailure("Your observations changed during rebuilding. Wait briefly, then retry; stale rows are not current.",409);
}
export async function readOwnedDailyFeatures(client:SupabaseClient<Database>,owner:string,range:{from:string;to:string;scope:FeatureScope}){
 // No privileged key needed for reads. RLS filters stale generations and zones.
 for(let attempt=0;attempt<3;attempt++){
  const state=await client.from("feature_input_generations").select("generation").eq("user_id",owner).maybeSingle();
  const profile=await client.from("profiles").select("time_zone").eq("user_id",owner).single();
  if(state.error||profile.error||!profile.data)throw new RequestFailure("Daily storage is unavailable. Apply migration 007 and restore your profile.",503);
  const version=builderVersion(range.scope),zone=TimeZoneSchema.parse(profile.data.time_zone);
  const result=await client.from("daily_features").select("*").eq("user_id",owner).eq("time_zone",zone).eq("builder_version",version).gte("date",range.from).lte("date",range.to).order("date").limit(60);
  if(result.error)throw new RequestFailure("Daily rows could not load.",503);
  const again=await client.from("feature_input_generations").select("generation").eq("user_id",owner).maybeSingle();
  const latestProfile=await client.from("profiles").select("time_zone").eq("user_id",owner).single();
  if(again.error||latestProfile.error)throw new RequestFailure("Daily freshness could not be confirmed.",503);
  if((state.data?.generation??0)!==(again.data?.generation??0)||zone!==latestProfile.data?.time_zone)continue;
  const rows:DailyFeatures[]=(result.data??[]).map(row=>{
   const parsed=DailyFeaturesSchema.parse(row.payload);
   if(row.user_id!==owner||parsed.userId!==owner||row.date!==parsed.date||parsed.timeZone!==zone||parsed.builderVersion!==version||row.input_generation!==(again.data?.generation??0))throw new Error("Daily metadata mismatch");
   return parsed;
  });
  const dates=new Set(rows.map(r=>r.date));
  return {rows,missingDates:featureDates(range.from,range.to).filter(d=>!dates.has(d)),timeZone:zone,builderVersion:version,scope:range.scope,freshness:"current_at_read" as const};
 }
 throw new RequestFailure("Your observations changed while reading. Retry to load current daily rows.",409);
}
