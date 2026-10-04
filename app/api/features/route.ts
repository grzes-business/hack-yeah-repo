import { z } from "zod";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { FeatureRangeSchema } from "@/lib/features/contracts";
import { readOwnedDailyFeatures, rebuildOwnedDailyFeatures } from "@/lib/features/server";
export const runtime="nodejs";
export const maxDuration=120;
const headers={"Cache-Control":"no-store"};
function failure(error:unknown){
 return Response.json({error:error instanceof RequestFailure?error.message:error instanceof z.ZodError?"Provide a valid date range of up to 60 days and personal or demo scope.":"Daily processing failed. No new daily rows were confirmed. Retry."},{status:error instanceof RequestFailure?error.status:error instanceof z.ZodError?400:503,headers});
}
export async function POST(request:Request){
 try{
  const {client,owner}=await authenticatedDatabase(request);
  const range=FeatureRangeSchema.parse(await boundedJson(request,2000));
  return Response.json(await rebuildOwnedDailyFeatures(client,owner,range),{headers});
 }catch(error){return failure(error);}
}
export async function GET(request:Request){
 try{
  const {client,owner}=await authenticatedDatabase(request);
  const params=new URL(request.url).searchParams;
  const range=FeatureRangeSchema.parse(Object.fromEntries(params));
  return Response.json(await readOwnedDailyFeatures(client,owner,range),{headers});
 }catch(error){return failure(error);}
}
