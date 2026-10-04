import { z } from "zod";
import { authenticatedDatabase, boundedJson, RequestFailure } from "@/lib/db/server";
import { ExperimentActionSchema } from "@/lib/experiments/contracts";
import { applyExperimentAction, listExperiments } from "@/lib/experiments/server";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  const message = error instanceof RequestFailure ? error.message : error instanceof z.ZodError ? "Invalid experiment request." : "Experiments are unavailable. Retry.";
  const status = error instanceof RequestFailure ? error.status : error instanceof z.ZodError ? 400 : 503;
  return Response.json({ error: message }, { status, headers });
}

export async function GET(request: Request) {
  try {
    const { client, owner } = await authenticatedDatabase(request);
    return Response.json(await listExperiments(client, owner), { headers });
  } catch (error) { return failure(error); }
}

/** Owner is always derived from the verified session; plans come from code templates only. */
export async function POST(request: Request) {
  try {
    const { client, owner } = await authenticatedDatabase(request);
    await applyExperimentAction(owner, ExperimentActionSchema.parse(await boundedJson(request, 500)));
    return Response.json(await listExperiments(client, owner), { headers });
  } catch (error) { return failure(error); }
}
