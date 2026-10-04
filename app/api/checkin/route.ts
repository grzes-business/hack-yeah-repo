import { getCheckin, updateCheckin, resetCheckin } from "@/lib/checkin/server";
export const runtime="nodejs";
export const GET=getCheckin;
export const POST=updateCheckin;
export const DELETE=resetCheckin;
