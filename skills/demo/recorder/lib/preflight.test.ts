import assert from "node:assert/strict";
import { test } from "node:test";
import { checkHealth, formatResult, preflight, type PageLike } from "./preflight.ts";

const fakePage = (broken: Set<string>): PageLike => ({
  locator: (selector: string) => ({
    first: () => ({
      waitFor: async () => {
        if (broken.has(selector)) throw new Error(`timeout waiting for ${selector}`);
      },
    }),
  }),
});

const scene = (name: string, expect?: string[]) => ({ name, expect, run: async () => {} });

test("preflight passes when every selector is visible and runs every scene", async () => {
  const ran: string[] = [];
  const r = await preflight(fakePage(new Set()), [scene("a", ["#x"]), scene("b")], async (s) => { ran.push(s.name); });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(ran, ["a", "b"]);
});

test("preflight stops at the first broken selector and names scene and selector", async () => {
  const ran: string[] = [];
  const scenes = [scene("open", ["#ok"]), scene("submit", ["#ok", "#gone"]), scene("later", ["#gone2"])];
  const r = await preflight(fakePage(new Set(["#gone", "#gone2"])), scenes, async (s) => { ran.push(s.name); });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.scene, "submit");
  assert.equal(!r.ok && r.selector, "#gone");
  assert.deepEqual(ran, ["open"]);
  assert.match(formatResult(r), /submit.*#gone/);
});

test("preflight reports a scene whose run throws", async () => {
  const r = await preflight(fakePage(new Set()), [scene("boom")], async () => { throw new Error("click failed"); });
  assert.equal(!r.ok && r.scene, "boom");
  assert.match(formatResult(r), /boom.*click failed/);
});

test("checkHealth returns null on 2xx and a message otherwise", async () => {
  const ok = async () => new Response("ok", { status: 200 });
  const down = async () => new Response("no", { status: 503 });
  const dead = async () => { throw new Error("ECONNREFUSED"); };
  assert.equal(await checkHealth("http://h", ok), null);
  assert.match((await checkHealth("http://h", down)) ?? "", /503/);
  assert.match((await checkHealth("http://h", dead)) ?? "", /ECONNREFUSED/);
});
