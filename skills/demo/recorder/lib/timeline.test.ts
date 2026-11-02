import assert from "node:assert/strict";
import { test } from "node:test";
import { FAST_CAP, FAST_DEFAULT, fastSegments, fitSpeeds, joinTakes, outputLength, toOutput } from "./timeline.ts";

test("fastSegments pairs on/off marks into relative-second segments", () => {
  const marks = [
    { t: 2000, kind: "fast" as const, on: true },
    { t: 6000, kind: "fast" as const, on: false },
    { t: 8000, kind: "fast" as const, on: true, speed: 5 },
    { t: 9000, kind: "fast" as const, on: false },
  ];
  assert.deepEqual(fastSegments(marks), [
    { a: 2, b: 6, speed: FAST_DEFAULT },
    { a: 8, b: 9, speed: 5 },
  ]);
});

test("toOutput compresses time inside fast segments", () => {
  const segs = [{ a: 10, b: 40, speed: 3 }];
  assert.equal(toOutput(5, segs), 5);
  assert.equal(toOutput(40, segs), 20);
  assert.equal(toOutput(50, segs), 30);
  assert.equal(outputLength(50, segs), 30);
});

test("fitSpeeds leaves segments alone when the cut already fits", () => {
  const segs = [{ a: 0, b: 30, speed: FAST_DEFAULT }];
  const fit = fitSpeeds(segs, 60, 100);
  assert.deepEqual(fit.segs, segs);
  assert.equal(fit.overBudget, false);
});

test("fitSpeeds speeds up default segments just enough to fit the budget", () => {
  const segs = [{ a: 0, b: 60, speed: FAST_DEFAULT }, { a: 70, b: 80, speed: 2 }];
  const fit = fitSpeeds(segs, 100, 50);
  assert.ok(fit.segs[0].speed > FAST_DEFAULT);
  assert.equal(fit.segs[1].speed, 2, "custom speeds are kept");
  assert.ok(outputLength(100, fit.segs) <= 50);
  assert.equal(fit.overBudget, false);
});

test("fitSpeeds caps speed and reports when the budget cannot be met", () => {
  const segs = [{ a: 0, b: 10, speed: FAST_DEFAULT }];
  const fit = fitSpeeds(segs, 100, 20);
  assert.equal(fit.segs[0].speed, FAST_CAP);
  assert.equal(fit.overBudget, true);
});

test("joinTakes lays scenes end to end and shifts their marks", () => {
  const viewport = { width: 100, height: 50 };
  const takes = [
    { name: "one", viewport, start: 1000, end: 4000, frames: [{ file: "frames/one/0.jpg", t: 1100 }], marks: [] },
    {
      name: "two", viewport, start: 9000, end: 11000,
      frames: [{ file: "frames/two/0.jpg", t: 9000 }],
      marks: [{ t: 10000, kind: "fast" as const, on: true }],
    },
  ];
  const j = joinTakes(takes);
  assert.equal(j.wall, 5);
  assert.deepEqual(j.scenes, [{ name: "one", start: 0, end: 3 }, { name: "two", start: 3, end: 5 }]);
  assert.deepEqual(j.frames.map((f) => f.t), [0.1, 3]);
  assert.equal(j.marks[0].t, 4000, "marks come back in ms relative to the joined start");
});
