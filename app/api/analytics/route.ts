import { z } from "zod";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { AnalyticsInputSchema } from "@/lib/analytics/contracts";
import { ownedAnalytics } from "@/lib/analytics/server";
export const runtime="nodejs";
export const maxDuration=120;
const headers={"Cache-Control":"no-store"};
async function handle(request:Request,rebuild:boolean){
 try{
  const {client,owner}=await authenticatedDatabase(request);
  const input=AnalyticsInputSchema.parse(rebuild?await boundedJson(request,2000):Object.fromEntries(new URL(request.url).searchParams));
  return Response.json(await ownedAnalytics(client,owner,input,rebuild),{headers});
 }catch(error){return Response.json({error:error instanceof RequestFailure?error.message:error instanceof z.ZodError?"Invalid analysis date or scope.":"Analysis could not complete. No result is confirmed; retry."},{status:error instanceof RequestFailure?error.status:error instanceof z.ZodError?400:503,headers});}
}
export async function GET(request:Request){return handle(request,false);}
export async function POST(request:Request){return handle(request,true);}
