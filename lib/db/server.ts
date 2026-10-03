import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
export class RequestFailure extends Error { constructor(message: string, public status: number) { super(message); } }
export async function authenticatedDatabase(request: Request) {
 const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
 if (!token) throw new RequestFailure("Start a private demo session first.",401);
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) throw new RequestFailure("Demo storage is not configured.",503);
 const client = createClient<Database>(url,key,{ auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }, global:{ headers:{ Authorization:`Bearer ${token}` } } });
 const {data,error} = await client.auth.getUser(token);
 if (error || !data.user) throw new RequestFailure("Your session expired. Restore it and retry.",401);
 return {client, owner:data.user.id};
}
export async function boundedJson(request: Request, maximum: number) {
 const reader = request.body?.getReader(); if (!reader) throw new RequestFailure("Missing request.",400);
 const chunks: Uint8Array[]=[]; let size=0;
 while(true) { const part=await reader.read(); if(part.done) break; size+=part.value.length; if(size>maximum) { await reader.cancel(); throw new RequestFailure("Request is too large.",413); } chunks.push(part.value); }
 try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new RequestFailure("Invalid request.",400); }
}
