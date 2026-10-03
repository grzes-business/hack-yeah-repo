import test from "node:test";
import assert from "node:assert/strict";
import { parseDevWindow } from "./dev-window";
import { getNextStep, CHECKIN_WINDOW } from "./controller";

test("the local test window overrides the morning window only when well-formed", () => {
 assert.deepEqual(parseDevWindow(undefined), CHECKIN_WINDOW);
 assert.deepEqual(parseDevWindow("nonsense"), CHECKIN_WINDOW);
 const open = parseDevWindow("00:00-23:59");
 assert.equal(open.startMinute, 0);
 assert.equal(open.endMinute, 23 * 60 + 59);
 assert.equal(getNextStep({ localDate: "2026-10-04", answered: [], skipped: [], ended: false }, 22 * 60, open).kind, "ask");
});
