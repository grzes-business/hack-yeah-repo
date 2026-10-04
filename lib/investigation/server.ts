import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addCalendarDays } from "../domain";
import type { Database } from "../db/database.types";
import { RequestFailure } from "../db/server";
import { ownedAnalytics } from "../analytics/server";
import { featureWriter, readFeatureGeneration, readOwnedDailyFeatures } from "../features/server";
import { InvestigationInputSchema, InvestigationResultSchema, type InvestigationInput } from "./contracts";
import { buildEvidenceBundle } from "./bundle";
import { explainEvidence } from "./explain";
export async function investigateOwnedOutcome(client:SupabaseClient<Database>,owner:string,raw:InvestigationInput){
 const input=InvestigationInputSchema.parse(raw),writer=featureWriter();
 for(let attempt=0;attempt<3;attempt++){
  const analysis=await ownedAnalytics(client,owner,{date:input.date,scope:input.scope},true);
  if(analysis.needsAnalysis||!analysis.report)throw new RequestFailure("Investigation could not obtain current analysis.",503);
  const report=analysis.report;
  const context=await readOwnedDailyFeatures(client,owner,{from:addCalendarDays(input.date,-1),to:input.date,scope:input.scope});
  const state=await readFeatureGeneration(writer,owner);
  if(context.missingDates.length||state.generation!==report.inputGeneration||state.timeZone!==report.timeZone)continue;
  const bundle=buildEvidenceBundle(report,input.outcome,context.rows);
  const explanation=await explainEvidence(bundle,input.scope,input.language);
  // Explanation latency must not let superseded evidence escape as current.
  const latest=await readFeatureGeneration(writer,owner);
  if(latest.generation!==report.inputGeneration||latest.timeZone!==report.timeZone)continue;
  return InvestigationResultSchema.parse({mode:"investigate",scope:input.scope,inputGeneration:latest.generation,bundle,explanation});
 }
 throw new RequestFailure("Observations changed while explaining the evidence. Retry after capture/import finishes.",409);
}
