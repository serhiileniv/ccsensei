import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import type { Frame } from "./types.ts";
import { type Segment, toOutput } from "./timeline.ts";

export const FPS = 30;
const FADE_S = 0.35;
const MIN_FRAME_S = 0.001;

export interface Overlay { png: string; a: number; b: number }

export function ffmpeg(args: string[]): void {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
}

export function probeDuration(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(out.toString().trim());
}

/** Writes an ffconcat list whose per-frame durations apply the speed ramps; returns output seconds. */
export function writeConcat(frames: Frame[], wall: number, segs: Segment[], path: string): number {
  const lines = ["ffconcat version 1.0"];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.t ?? wall;
    const dur = Math.max(MIN_FRAME_S, toOutput(next, segs) - toOutput(f.t, segs));
    lines.push(`file '${f.file}'`, `duration ${dur.toFixed(4)}`);
  });
  lines.push(`file '${frames[frames.length - 1].file}'`);
  writeFileSync(path, lines.join("\n"));
  return toOutput(wall, segs);
}

/** Looped still-image inputs for each overlay, lasting `seconds`. */
export const overlayInputs = (pngs: string[], seconds: number): string[] =>
  pngs.flatMap((png) => ["-loop", "1", "-framerate", `${FPS}`, "-t", seconds.toFixed(3), "-i", png]);

/** Fades each overlay in/out over `base`; overlay i is input `first + i`. Returns filters and the last label. */
export function overlayChain(base: string, overlays: Overlay[], first: number, tag: string): { filters: string[]; out: string } {
  const filters = overlays.flatMap((o, i) => {
    const out = Math.max(o.a, o.b - FADE_S).toFixed(3);
    const from = i === 0 ? base : `${tag}${i}`;
    return [
      `[${first + i}:v]format=rgba,fade=t=in:st=${o.a.toFixed(3)}:d=${FADE_S}:alpha=1,fade=t=out:st=${out}:d=${FADE_S}:alpha=1[${tag}o${i}]`,
      `[${from}][${tag}o${i}]overlay=0:0:enable='between(t,${o.a.toFixed(3)},${o.b.toFixed(3)})':format=auto[${tag}${i + 1}]`,
    ];
  });
  return { filters, out: overlays.length ? `${tag}${overlays.length}` : base };
}
