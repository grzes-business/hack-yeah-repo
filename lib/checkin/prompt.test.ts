import assert from "node:assert/strict";
import { test } from "node:test";
import { morningPrompt, pendingDimensions } from "./prompt";

test("one morning prompt covers every open dimension", () => {
  assert.equal(morningPrompt(pendingDimensions([], [])), "In one sentence: energy, soreness and mood from 0 to 10, and are you feeling ill?");
  assert.equal(morningPrompt(pendingDimensions(["energy", "mood"], ["soreness"])), "In one sentence: are you feeling ill?");
  assert.equal(morningPrompt(pendingDimensions(["illness"], [])), "In one sentence: energy, soreness and mood from 0 to 10?");
  assert.equal(morningPrompt([]), "Anything else about this morning?");
});
