import assert from "node:assert/strict";
import { test } from "node:test";
import { lint } from "./lint.ts";

test("lint is quiet for an early wow and short captions", () => {
  assert.deepEqual(lint([{ name: "a", start: 3, caption: "Short and sweet", wow: true }]), []);
});

test("lint warns when the first wow starts after 15 s", () => {
  const w = lint([{ name: "intro", start: 2 }, { name: "big", start: 16.2, wow: true }, { name: "late", start: 30, wow: true }]);
  assert.equal(w.length, 1);
  assert.match(w[0], /big.*16\.2/);
});

test("lint warns when no scene is flagged wow", () => {
  assert.match(lint([{ name: "a", start: 0 }])[0], /wow/);
});

test("lint warns on captions over 8 words", () => {
  const w = lint([{ name: "a", start: 0, wow: true, caption: "one two three four five six seven eight nine" }]);
  assert.equal(w.length, 1);
  assert.match(w[0], /a.*9 words/);
});
