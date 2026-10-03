import test from "node:test";
import assert from "node:assert/strict";
import { getNextStep, isWindowOpen, localClock, questionFor, CHECKIN_DIMENSIONS, type CheckinProgress } from "./controller";

const morning = 8 * 60;
const progress = (overrides: Partial<CheckinProgress> = {}): CheckinProgress => ({ localDate: "2026-10-04", answered: [], skipped: [], ended: false, ...overrides });

test("asks the registered dimensions in the fixed priority order", () => {
 assert.deepEqual(CHECKIN_DIMENSIONS, ["energy", "soreness", "mood", "illness"]);
 assert.deepEqual(getNextStep(progress(), morning), { kind: "ask", dimension: "energy", localDate: "2026-10-04" });
});

const askedDimension = (step: ReturnType<typeof getNextStep>) => (step.kind === "ask" ? step.dimension : step.kind);

test("skips answered dimensions and asks the next missing one", () => {
 assert.equal(askedDimension(getNextStep(progress({ answered: ["energy"] }), morning)), "soreness");
 assert.equal(askedDimension(getNextStep(progress({ answered: ["energy", "soreness"] }), morning)), "mood");
});

test("a skipped dimension stays unknown and is not asked again", () => {
 const step = getNextStep(progress({ skipped: ["energy"] }), morning);
 assert.deepEqual(step, { kind: "ask", dimension: "soreness", localDate: "2026-10-04" });
});

test("completion distinguishes fully answered from resolved with skips", () => {
 assert.deepEqual(getNextStep(progress({ answered: [...CHECKIN_DIMENSIONS] }), morning), { kind: "complete", localDate: "2026-10-04", reason: "all_answered" });
 assert.deepEqual(getNextStep(progress({ answered: ["energy", "soreness", "mood"], skipped: ["illness"] }), morning), { kind: "complete", localDate: "2026-10-04", reason: "resolved_with_skips" });
});

test("an explicit end is terminal for the day, even inside the window", () => {
 assert.deepEqual(getNextStep(progress({ ended: true }), morning), { kind: "closed", localDate: "2026-10-04", reason: "ended" });
});

test("the window is [05:00, 12:00) local", () => {
 assert.equal(isWindowOpen(4 * 60 + 59), false);
 assert.equal(isWindowOpen(5 * 60), true);
 assert.equal(isWindowOpen(11 * 60 + 59), true);
 assert.equal(isWindowOpen(12 * 60), false);
 assert.deepEqual(getNextStep(progress(), 12 * 60), { kind: "closed", localDate: "2026-10-04", reason: "outside_window" });
});

test("local date and minute follow the user's zone across midnight", () => {
 // 22:30 UTC is 00:30 the next day in Warsaw (CEST): the local date advances even though UTC has not.
 assert.deepEqual(localClock("2026-10-03T22:30:00.000Z", "Europe/Warsaw"), { localDate: "2026-10-04", minute: 30 });
 assert.deepEqual(localClock("2026-10-03T21:30:00.000Z", "Europe/Warsaw"), { localDate: "2026-10-03", minute: 23 * 60 + 30 });
});

test("identical progress and clock give the identical step", () => {
 const state = progress({ answered: ["energy"], skipped: ["mood"] });
 assert.deepEqual(getNextStep(state, morning), getNextStep({ ...state, answered: [...state.answered], skipped: [...state.skipped] }, morning));
});

test("questions use registry anchors and only the four dimensions", () => {
 assert.match(questionFor("energy"), /from 0 \(no energy\) to 10 \(very energetic\)/);
 assert.match(questionFor("soreness"), /0 \(no soreness\) to 10 \(extreme soreness\)/);
 assert.match(questionFor("illness"), /yes or no/);
});
