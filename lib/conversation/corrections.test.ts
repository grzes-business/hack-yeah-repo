import test from "node:test";
import assert from "node:assert/strict";
import { guardCorrection } from "../capture/correction-guard";
import { untrackedMetricName, unsupportedMetricReply } from "./unsupported";
import { VoiceIntentSchema } from "./controller-contracts";
import { ExtractionResultSchema, type ExtractionResult } from "../domain";

const now = "2026-10-03T08:00:00.000Z";
const base = { occurredAt: now, capturedAt: now, timeZone: "Europe/Warsaw", conversationTurnId: "turn", extractionConfidence: null };
const coffee = { ...base, id: "coffee", type: "caffeine" as const, value: { consumed: true, amountMg: null } };
const noCoffee = { ...coffee, value: { consumed: false, amountMg: 0 } };
const noAlcohol = { ...base, id: "alcohol", type: "alcohol" as const, value: { consumed: false, quantity: 0, unit: "reported_drinks" as const } };
const twoDrinks = { ...base, id: "alcohol", type: "alcohol" as const, value: { consumed: true, quantity: 2, unit: "reported_drinks" as const } };
const soreness = { ...base, id: "soreness", type: "soreness" as const, value: 6 };
const captured = (...events: unknown[]) => ({ status: "captured", events }) as unknown as ExtractionResult;
const original = "I had coffee today and my legs are sore from yesterday";
const correction = "Actually I did not drink any coffee today, keep soreness at six";
const none = { accepted: null, open: [] };
const clarifiedTypes = (result: ExtractionResult) => (result.status === "needs_clarification" ? result.eventTypes : []);

test("correction guard refuses a follow-up that drops an accepted observation", () => {
 const guarded = guardCorrection(captured(soreness), { original, followup: "Keep soreness six yesterday" }, { accepted: captured(coffee, soreness), open: [] });
 assert.equal(guarded.status, "needs_clarification");
 assert.deepEqual(clarifiedTypes(guarded), ["caffeine"]);
});

test("correction guard refuses a negated coffee that still reports consumption", () => {
 const guarded = guardCorrection(captured(coffee, soreness), { original, followup: correction }, { accepted: captured(coffee, soreness), open: [] });
 assert.deepEqual(clarifiedTypes(guarded), ["caffeine"]);
});

test("correction guard accepts a negated coffee recorded as not consumed", () => {
 const result = captured(noCoffee, soreness);
 assert.equal(guardCorrection(result, { original, followup: correction }, { accepted: captured(coffee, soreness), open: [] }), result);
});

test("correction guard removes an alcohol event the speaker never mentioned", () => {
 const guarded = guardCorrection(captured(noCoffee, noAlcohol, soreness), { original, followup: correction }, { accepted: captured(coffee, soreness), open: [] });
 assert.equal(guarded.status, "captured");
 assert.deepEqual(guarded.status === "captured" ? guarded.events.map(e => e.type) : [], ["caffeine", "soreness"]);
});

test("correction guard refuses when every new observation is unmentioned", () => {
 assert.equal(guardCorrection(captured(noAlcohol), { original, followup: "Keep it as it was" }, none).status, "needs_clarification");
});

test("correction guard treats 'I do not know the dose' as unknown, not as no coffee", () => {
 const result = captured(coffee, soreness);
 assert.equal(guardCorrection(result, { original, followup: "My soreness was six out of ten yesterday. The coffee was today; I do not know its caffeine amount." }, none), result);
});

test("open items must all be answered before anything is saved", () => {
 const guarded = guardCorrection(captured(soreness), { original: "I drank alcohol and I was sore", followup: "six out of ten" }, { accepted: null, open: ["alcohol", "soreness"] });
 assert.deepEqual(clarifiedTypes(guarded), ["alcohol"]);
});

test("one number cannot answer two open items", () => {
 const guarded = guardCorrection(captured(twoDrinks, soreness), { original: "I drank alcohol and I was sore", followup: "one" }, { accepted: null, open: ["alcohol", "soreness"] });
 assert.deepEqual(clarifiedTypes(guarded), ["alcohol", "soreness"]);
});

test("answers with units or order for each open item are kept", () => {
 const result = captured(twoDrinks, soreness);
 const followup = "two drinks, and six out of ten";
 assert.equal(guardCorrection(result, { original: "I drank alcohol today and I was sore yesterday", followup }, { accepted: null, open: ["alcohol", "soreness"] }), result);
});

test("an unknown caffeine dose does not need a number", () => {
 const result = captured(coffee, soreness);
 const followup = "My soreness was six out of ten yesterday. I do not know the coffee amount.";
 assert.equal(guardCorrection(result, { original, followup }, { accepted: null, open: ["caffeine", "soreness"] }), result);
});

test("keeps first-pass results and clarifications unchanged", () => {
 const result = captured(coffee, soreness);
 assert.equal(guardCorrection(result, { original, followup: "My soreness was six out of ten yesterday" }, none), result);
 const clarification = ExtractionResultSchema.parse({ status: "needs_clarification", eventTypes: ["soreness"], reason: "What rating?" });
 assert.equal(guardCorrection(clarification, { original, followup: "no" }, { accepted: captured(coffee), open: ["soreness"] }), clarification);
});

test("stored clarifications from the single-type format read as one open item", () => {
 const parsed = ExtractionResultSchema.parse({ status: "needs_clarification", eventType: "soreness", reason: "What rating?" });
 assert.deepEqual(clarifiedTypes(parsed), ["soreness"]);
});

test("untracked measurements are detected only as whole words", () => {
 assert.equal(untrackedMetricName("What was my HRV in the past seven days?"), "hrv");
 assert.equal(untrackedMetricName("How did I sleep this week"), "sleep");
 assert.equal(untrackedMetricName("I drank two beers and my soreness is six"), null);
 assert.equal(untrackedMetricName("I was sore yesterday"), null);
});

test("unsupported metric replies name the metric and the supported types", () => {
 const reply = unsupportedMetricReply("hrv", "en");
 assert.match(reply, /hrv/);
 assert.match(reply, /soreness/);
});

test("intent schema requires the unsupported metric field", () => {
 assert.throws(() => VoiceIntentSchema.parse({ kind: "retrieve", language: "en", query: { kind: "unspecified", from: null, to: null, type: null, includeDemo: false } }));
 assert.equal(VoiceIntentSchema.parse({ kind: "retrieve", language: "en", query: { kind: "unspecified", from: null, to: null, type: null, includeDemo: false }, unsupportedMetric: "hrv", investigationOutcome:null }).unsupportedMetric, "hrv");
});
