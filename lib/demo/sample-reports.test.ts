import assert from "node:assert/strict";
import { test } from "node:test";
import { createSubjectiveFixtures } from "./subjective-fixtures";

test("sample reports are fictional, labeled and never routed to the synthetic demo scope", () => {
  const options = { endDate: "2026-10-03", timeZone: "Europe/Warsaw", days: 30, seed: 2026 };
  const sample = createSubjectiveFixtures(options, "sample"), demo = createSubjectiveFixtures(options);
  assert.ok(sample.events.length > 0);
  assert.ok(sample.events.every(e => e.id.startsWith("sample:v1:") && !e.id.startsWith("demo:")));
  assert.ok(sample.turns.every(t => t.transcript.startsWith("[Sample report; fictional")));
  // Same scenario values, different identity: removal by prefix cannot touch demo or real records.
  assert.deepEqual(sample.events.map(e => [e.type, e.value]), demo.events.map(e => [e.type, e.value]));
  assert.equal(new Set([...sample.events, ...demo.events].map(e => e.id)).size, sample.events.length + demo.events.length);
});
