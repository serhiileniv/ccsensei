import assert from "node:assert/strict";
import { test } from "node:test";
import { EASE_S, MAX_ZOOM, cropAt, ease, fitScale, zoomAt, zoomExpr, zoomWindows } from "./zoom.ts";

const FRAME = { width: 1920, height: 1080 };
const VIEW = { width: 1440, height: 810 };

test("ease is 0 at 0, 1/2 at 1/2, 1 at 1, clipped outside", () => {
  assert.equal(ease(-1), 0);
  assert.ok(Math.abs(ease(0.5) - 0.5) < 1e-9);
  assert.equal(ease(2), 1);
});

test("fitScale zooms small targets up to the cap and never below 1", () => {
  assert.equal(fitScale({ x: 0, y: 0, width: 10, height: 10 }, VIEW), MAX_ZOOM);
  assert.equal(fitScale({ x: 0, y: 0, width: 1440, height: 810 }, VIEW), 1);
  const mid = fitScale({ x: 0, y: 0, width: 600, height: 200 }, VIEW);
  assert.ok(mid > 1 && mid < MAX_ZOOM);
});

test("zoomWindows drops a focus superseded within the ease time and hands over to the next", () => {
  const w = zoomWindows([
    { t: 1, holdS: 2, scale: 1.5, cx: 0.2, cy: 0.2 },
    { t: 1 + EASE_S / 2, holdS: 2, scale: 1.8, cx: 0.5, cy: 0.5 },
    { t: 3, holdS: 2, scale: 1.4, cx: 0.8, cy: 0.8 },
  ]);
  assert.equal(w.length, 2);
  assert.equal(w[0].scale, 1.8);
  assert.equal(w[0].b, 3 + EASE_S, "first window ends one ease after the next starts");
});

test("zoomAt eases in, holds, and pans straight to the next focus without zooming out", () => {
  const w = zoomWindows([
    { t: 0, holdS: 2, scale: 2, cx: 0.25, cy: 0.5 },
    { t: 2, holdS: 2, scale: 2, cx: 0.75, cy: 0.5 },
  ]);
  assert.equal(zoomAt(0, w).scale, 1);
  assert.ok(Math.abs(zoomAt(EASE_S / 2, w).scale - 1.5) < 1e-9);
  assert.equal(zoomAt(1, w).scale, 2);
  const handover = zoomAt(2 + EASE_S / 2, w);
  assert.ok(Math.abs(handover.scale - 2) < 1e-9);
  assert.ok(Math.abs(handover.cx - 0.5) < 1e-9);
  assert.equal(zoomAt(100, w).scale, 1);
});

test("cropAt keeps the crop inside the frame even for a corner focus", () => {
  const w = zoomWindows([{ t: 0, holdS: 3, scale: 2, cx: 0.99, cy: 0.01 }]);
  for (let t = 0; t <= 5; t += 0.1) {
    const c = cropAt(t, w, FRAME);
    assert.ok(c.x >= 0 && c.y >= 0, `origin inside at ${t}`);
    assert.ok(c.x + c.width <= FRAME.width + 1e-6 && c.y + c.height <= FRAME.height + 1e-6, `far edge inside at ${t}`);
  }
  assert.deepEqual(cropAt(1, w, FRAME), { x: 960, y: 0, width: 960, height: 540 });
});

test("zoomExpr is identity with no windows and mentions each window otherwise", () => {
  assert.equal(zoomExpr([], "it").z, "1");
  const e = zoomExpr(zoomWindows([{ t: 4, holdS: 1, scale: 1.5, cx: 0.5, cy: 0.5 }]), "it");
  assert.match(e.z, /it-4\.000/);
  assert.match(e.cx, /^0\.5\+/);
});
