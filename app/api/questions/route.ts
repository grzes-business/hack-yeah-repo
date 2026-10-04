import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { QuestionActionSchema } from "@/lib/questions/contracts";
import { questionAction, readQuestionLoop } from "@/lib/questions/server";
export const runtime="nodejs";
export const maxDuration=120;
const headers={"Cache-Control":"no-store"};
function failed(error:unknown){return Response.json({error:error instanceof RequestFailure?error.message:"Question processing could not complete. Reload its state: a saved answer may need evidence refresh."},{status:error instanceof RequestFailure?error.status:503,headers});}
export async function GET(request:Request){try{const {client,owner}=await authenticatedDatabase(request);return Response.json(await readQuestionLoop(client,owner),{headers});}catch(error){return failed(error);}}
export async function POST(request:Request){try{
 const {client,owner}=await authenticatedDatabase(request),parsed=QuestionActionSchema.safeParse(await boundedJson(request,5000));
 if(!parsed.success)throw new RequestFailure("Invalid question action.",400);
 return Response.json(await questionAction(client,owner,parsed.data),{headers});
}catch(error){return failed(error);}}
