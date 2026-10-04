import { z } from "zod";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { InvestigationInputSchema } from "@/lib/investigation/contracts";
import { investigateOwnedOutcome } from "@/lib/investigation/server";
export const runtime="nodejs";
export const maxDuration=120;
export async function POST(request:Request){
 try{
  const {client,owner}=await authenticatedDatabase(request);
  const input=InvestigationInputSchema.parse(await boundedJson(request,2000));
  return Response.json(await investigateOwnedOutcome(client,owner,input),{headers:{"Cache-Control":"no-store"}});
 }catch(error){return Response.json({error:error instanceof RequestFailure?error.message:error instanceof z.ZodError?"Invalid investigation outcome, date or mode.":"Investigation could not complete. No explanation is confirmed; retry."},{status:error instanceof RequestFailure?error.status:error instanceof z.ZodError?400:503,headers:{"Cache-Control":"no-store"}});}
}
