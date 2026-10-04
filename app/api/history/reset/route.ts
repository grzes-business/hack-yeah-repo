import { z } from "zod";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { featureWriter } from "@/lib/features/server";
export const runtime="nodejs";
export const maxDuration=60;
const headers={"Cache-Control":"no-store"};
const ResetSchema=z.strictObject({confirmation:z.literal("CLEAR MY HISTORY")});
export async function POST(request:Request){
 try{
  const {owner}=await authenticatedDatabase(request);
  const input=ResetSchema.safeParse(await boundedJson(request,200));
  if(!input.success)throw new RequestFailure("Confirm clearing your history before submitting.",400);
  const writer=featureWriter();
  const result=await writer.rpc("reset_owned_history",{p_owner:owner});
  if(result.error)throw new RequestFailure("History clearing was not confirmed. Check migration 008 and retry. Your session and profile are preserved.",503);
  // Experiment plans reference the cleared history; a missing-table code means migration 011 is not applied yet.
  const experiments=await writer.from("experiments").delete().eq("user_id",owner);
  if(experiments.error&&!["42P01","PGRST205"].includes(experiments.error.code))throw new RequestFailure("History was cleared, but experiment plans were not. Retry clearing.",503);
  return Response.json({cleared:true},{headers});
 }catch(error){return Response.json({error:error instanceof RequestFailure?error.message:"History clearing was not confirmed. Retry."},{status:error instanceof RequestFailure?error.status:503,headers});}
}
