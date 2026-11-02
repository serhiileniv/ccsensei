import assert from "node:assert/strict";
import { test } from "node:test";
import { captionCues, holdSeconds, srtTime, toSrt } from "./captions.ts";

test("holdSeconds is at least 2 s and about 3 words per second", () => {
  assert.equal(holdSeconds("Two words"), 2);
  assert.equal(holdSeconds("one two three four five six seven eight nine"), 3);
  assert.equal(holdSeconds("  spaced   out  "), 2);
});

test("srtTime formats HH:MM:SS,mmm", () => {
  assert.equal(srtTime(0), "00:00:00,000");
  assert.equal(srtTime(3723.4567), "01:02:03,457");
});

test("captionCues skips uncaptioned scenes and never overlaps the next cue or the end", () => {
  const cues = captionCues([
    { caption: "First", start: 1 },
    { start: 2 },
    { caption: "Second caption here", start: 2.5 },
  ], 3.5);
  assert.deepEqual(cues, [
    { start: 1, end: 2.5, text: "First" },
    { start: 2.5, end: 3.5, text: "Second caption here" },
  ]);
});

test("toSrt numbers cues and uses arrow timestamps", () => {
  assert.equal(
    toSrt([{ start: 1, end: 3.25, text: "Hello" }, { start: 4, end: 6, text: "World" }]),
    "1\n00:00:01,000 --> 00:00:03,250\nHello\n\n2\n00:00:04,000 --> 00:00:06,000\nWorld\n",
  );
});
