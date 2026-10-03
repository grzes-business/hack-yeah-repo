// TEMPORARY LOCAL TEST OVERRIDE. Not for commit: delete this file and the marked lines in app/api/checkin/route.ts.
// Set CHECKIN_DEV_WINDOW=00:00-23:59 in .env.local and restart `pnpm dev`. Ignored when NODE_ENV is production.
import { CHECKIN_WINDOW, type CheckinWindow } from "./controller";

export function parseDevWindow(raw: string | undefined): CheckinWindow {
 const match = raw?.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
 if (process.env.NODE_ENV === "production" || !match) return CHECKIN_WINDOW;
 const startMinute = Number(match[1]) * 60 + Number(match[2]);
 const endMinute = Number(match[3]) * 60 + Number(match[4]);
 return { opensAt: `${match[1]}:${match[2]}`, closesAt: `${match[3]}:${match[4]}`, startMinute, endMinute };
}
