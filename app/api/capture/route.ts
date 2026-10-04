import { captureHistory, captureOwnedTurn } from "@/lib/capture/server";
export const runtime="nodejs";
export const maxDuration=60;
export const GET=captureHistory;
export async function POST(request:Request){return captureOwnedTurn(request);}
