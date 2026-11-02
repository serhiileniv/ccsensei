import assert from "node:assert/strict";
import { test } from "node:test";
import { validateScenario } from "./validate.ts";

const run = async (): Promise<void> => {};
const meta = { title: "Demo", url: "http://localhost:3000" };

test("a well-formed scenario has no errors", () => {
  assert.deepEqual(validateScenario({ meta, scenes: [{ name: "open-app", run, caption: "Hi", expect: ["#app"] }] }), []);
});

test("missing scenes and meta are reported", () => {
  const errors = validateScenario({});
  assert.ok(errors.some((e) => /scenes/.test(e)));
  assert.ok(errors.some((e) => /meta/.test(e)));
});

test("bad scene fields are reported with the scene index", () => {
  const errors = validateScenario({
    meta,
    scenes: [
      { name: "Bad Name", run },
      { name: "ok", run: "nope" },
      { name: "ok", run, expect: "#x" },
    ],
  });
  assert.ok(errors.some((e) => /scenes\[0\].*name/.test(e)));
  assert.ok(errors.some((e) => /scenes\[1\].*run/.test(e)));
  assert.ok(errors.some((e) => /scenes\[2\].*duplicate/.test(e)));
  assert.ok(errors.some((e) => /scenes\[2\].*expect/.test(e)));
});

test("bad meta is reported", () => {
  const errors = validateScenario({ meta: { title: "", url: "not a url", maxSeconds: -1 }, scenes: [{ name: "a", run }] });
  assert.equal(errors.length, 3);
});
