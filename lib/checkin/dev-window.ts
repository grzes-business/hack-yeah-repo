// Check-in window overrides. Development: the test panel header or CHECKIN_DEV_WINDOW.
// Production: only the server env CHECKIN_WINDOW (e.g. "00:00-23:59" for a demo day); headers are ignored.
import { CHECKIN_WINDOW, type CheckinWindow } from "./controller";

function parse(raw: string | undefined): CheckinWindow | null {
 const match = raw?.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
 if (!match) return null;
 const startMinute = Number(match[1]) * 60 + Number(match[2]);
 const endMinute = Number(match[3]) * 60 + Number(match[4]);
 return startMinute < endMinute ? { opensAt: `${match[1]}:${match[2]}`, closesAt: `${match[3]}:${match[4]}`, startMinute, endMinute } : null;
}

export function parseDevWindow(raw: string | undefined): CheckinWindow {
 if (process.env.NODE_ENV === "production") return parse(process.env.CHECKIN_WINDOW) ?? CHECKIN_WINDOW;
 return parse(raw) ?? parse(process.env.CHECKIN_WINDOW) ?? CHECKIN_WINDOW;
}
