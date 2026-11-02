import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { replayOn } from "./lib/cards.ts";

test("render without frames/ says to record first", () => {
  const dir = mkdtempSync(join(tmpdir(), "render-"));
  cpSync(join(import.meta.dirname, "render.ts"), join(dir, "render.ts"));
  cpSync(join(import.meta.dirname, "lib"), join(dir, "lib"), { recursive: true });
  symlinkSync(join(import.meta.dirname, "node_modules"), join(dir, "node_modules"));
  const run = spawnSync(process.execPath, [join(dir, "render.ts")], { encoding: "utf8" });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /run `npm run record` first/);
});

test("replay chip follows the recording unless REPLAY overrides it", () => {
  assert.equal(replayOn(undefined, true), true);
  assert.equal(replayOn(undefined, undefined), false);
  assert.equal(replayOn("0", true), false);
  assert.equal(replayOn("1", false), true);
});
