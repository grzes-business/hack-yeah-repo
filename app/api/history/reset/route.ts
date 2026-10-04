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
  const result=await featureWriter().rpc("reset_owned_history",{p_owner:owner});
  if(result.error)throw new RequestFailure("History clearing was not confirmed. Check migration 008 and retry. Your session and profile are preserved.",503);
  return Response.json({cleared:true},{headers});
 }catch(error){return Response.json({error:error instanceof RequestFailure?error.message:"History clearing was not confirmed. Retry."},{status:error instanceof RequestFailure?error.status:503,headers});}
}
