import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { CaptureInputSchema, CaptureRecordSchema } from "@/lib/capture/contracts";
import { canonicalizeExtraction } from "@/lib/capture/canonicalize";
import { extractCandidates } from "@/lib/capture/provider";
import { ExtractionResultSchema, getLocalDate, RecordIdSchema, TimeZoneSchema } from "@/lib/domain";
import type { Json, Row } from "@/lib/db/database.types";

export const runtime="nodejs";
export const maxDuration=60;
const headers={"Cache-Control":"no-store"};
function record(row: Row<"turn_extractions">, owner: string) {
 if(row.user_id!==owner || row.extractor_version!=="capture-v1") throw new Error("Capture metadata mismatch.");
 return CaptureRecordSchema.parse({rootTurnId:row.root_turn_id,sourceTurnId:row.source_turn_id,revision:row.revision,result:row.result,acceptedResult:row.accepted_result,pending:row.lease_token!==null});
}
// Log only the operation and database code, never transcripts, events, or credentials.
function databaseFailure(operation: string, error: {code: string}) {
 console.error("[capture] Database operation failed", {operation, code:error.code});
}
function failed(error: unknown) {
 if(!(error instanceof RequestFailure)) console.error("[capture] Unexpected processing failure", {kind:error instanceof z.ZodError ? "validation" : "internal"});
 return Response.json({error:error instanceof RequestFailure ? error.message : "Extraction could not complete. No new observations were confirmed. Retry the capture."},{status:error instanceof RequestFailure ? error.status:503,headers});
}
export async function GET(request: Request) {
 try {
  const {client,owner}=await authenticatedDatabase(request);
  const conversationId=RecordIdSchema.parse(new URL(request.url).searchParams.get("conversationId"));
  const turns=await client.from("conversation_turns").select("id").eq("user_id",owner).eq("conversation_id",conversationId).eq("role","user").limit(500);
  if(turns.error) { databaseFailure("history_turns",turns.error); throw new RequestFailure("Capture history could not load.",503); }
  if(!turns.data?.length) return Response.json({records:[]},{headers});
  const rows=await client.from("turn_extractions").select("*").eq("user_id",owner).eq("extractor_version","capture-v1").in("root_turn_id",turns.data.map(t=>t.id));
  if(rows.error) { databaseFailure("history_extractions",rows.error); throw new RequestFailure("Capture storage is not ready. Apply the Stage 4 migration.",503); }
  return Response.json({records:(rows.data??[]).map(row=>record(row,owner))},{headers});
 } catch(error) { return failed(error instanceof z.ZodError ? new RequestFailure("Invalid conversation request.",400):error); }
}
export async function POST(request: Request) {
 let release: (()=>Promise<void>) | null=null;
 try {
  const {client,owner}=await authenticatedDatabase(request);
  const parsed=CaptureInputSchema.safeParse(await boundedJson(request,10000));
  if(!parsed.success) throw new RequestFailure("Invalid capture request.",400);
  const {turnId,followup}=parsed.data;
  const token=randomUUID();
  const claimed=await client.rpc("claim_turn_extraction",{p_root:turnId,p_token:token,p_revision:followup?.revision??null,p_followup_id:followup?.id??null,p_followup:followup?.text??null});
  if(claimed.error) { databaseFailure("claim",claimed.error); throw new RequestFailure(claimed.error.code==="P0001" ? "This turn changed or is not eligible. Reload capture history before retrying." : "Capture storage is not ready. Apply the Stage 4 migration.",claimed.error.code==="P0001"?409:503); }
  const payload=z.object({state:z.enum(["busy","cached","ready"]),job:z.unknown().optional(),root:z.unknown().optional(),source:z.unknown().optional()}).parse(claimed.data);
  if(payload.state==="busy") throw new RequestFailure("This observation is being captured. Wait briefly, then retry.",409);
  const job=payload.job as Row<"turn_extractions">;
  const view=record(job,owner);
  if(payload.state==="cached") return Response.json({record:view},{headers});
  release=async()=>{ await client.rpc("release_turn_extraction",{p_root:turnId,p_token:token}); };
  const root=payload.root as Row<"conversation_turns">; const source=payload.source as Row<"conversation_turns">;
  if(root.user_id!==owner || source.user_id!==owner || root.id!==turnId || source.id!==job.source_turn_id || source.conversation_id!==root.conversation_id || source.role!=="user") throw new Error("Capture provenance mismatch.");
  TimeZoneSchema.parse(job.time_zone);
  const anchorAt=new Date(job.anchor_at).toISOString(); const capturedAt=new Date(job.captured_at).toISOString();
  let candidates;
  try { candidates=await extractCandidates({transcript:root.transcript,followup:source.id===root.id?null:source.transcript,previousResult:{ latest:job.result, accepted:job.accepted_result },anchorDate:getLocalDate(anchorAt,job.time_zone),timeZone:job.time_zone}); }
  catch { throw new RequestFailure("The extraction service could not return a complete observation. Check connection, API billing/model access, then retry.",502); }
  const result=ExtractionResultSchema.parse(canonicalizeExtraction(candidates,{rootTurnId:turnId,sourceTurnId:source.id,anchorAt,capturedAt,timeZone:job.time_zone}));
  const saved=await client.rpc("finish_turn_extraction",{p_root:turnId,p_token:token,p_result:result as unknown as Json});
  if(saved.error) { databaseFailure("finish",saved.error); throw new RequestFailure("Observations were not confirmed. Retry to recover the transaction result.",503); }
  release=null;
  return Response.json({record:record(saved.data as Row<"turn_extractions">,owner)},{headers});
 } catch(error) {
  if(release) { try { await release(); } catch { /* The lease expires after 90 seconds if storage is unreachable. */ } }
  return failed(error);
 }
}
