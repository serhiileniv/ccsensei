import type { Frame, Mark, Take } from "./types.ts";

export const FAST_DEFAULT = 3;
export const FAST_CAP = 12;

export interface Segment { a: number; b: number; speed: number }
export interface Joined {
  frames: Frame[];
  marks: Mark[];
  scenes: { name: string; start: number; end: number }[];
  wall: number;
}

/** Pairs fast on/off marks (ms) into segments in seconds. */
export function fastSegments(marks: Mark[]): Segment[] {
  const segs: Segment[] = [];
  let open: { a: number; speed: number } | null = null;
  for (const m of marks) {
    if (m.kind !== "fast") continue;
    if (m.on) open = { a: m.t / 1000, speed: m.speed ?? FAST_DEFAULT };
    else if (open) {
      segs.push({ a: open.a, b: m.t / 1000, speed: open.speed });
      open = null;
    }
  }
  return segs;
}

/** Wall-clock seconds → output seconds. */
export function toOutput(t: number, segs: Segment[]): number {
  const inside = (s: Segment): number => Math.min(Math.max(t - s.a, 0), s.b - s.a);
  const lost = segs.reduce((acc, s) => acc + inside(s) - inside(s) / s.speed, 0);
  return t - lost;
}

export const outputLength = (wall: number, segs: Segment[]): number => toOutput(wall, segs);

/** Raises the default-speed segments just enough for the cut to fit `budget` seconds. */
export function fitSpeeds(segs: Segment[], wall: number, budget: number): { segs: Segment[]; overBudget: boolean } {
  if (outputLength(wall, segs) <= budget) return { segs, overBudget: false };
  const isFlex = (s: Segment): boolean => s.speed === FAST_DEFAULT;
  const flexWall = segs.filter(isFlex).reduce((acc, s) => acc + s.b - s.a, 0);
  const fixedOut = outputLength(wall, segs.map((s) => (isFlex(s) ? { ...s, speed: Infinity } : s)));
  const room = budget - fixedOut;
  const need = room > 0 ? Math.ceil((flexWall / room) * 10) / 10 : Infinity;
  const speed = Math.min(FAST_CAP, Math.max(FAST_DEFAULT, need));
  const fitted = segs.map((s) => (isFlex(s) ? { ...s, speed } : s));
  return { segs: fitted, overBudget: outputLength(wall, fitted) > budget };
}

/** Lays takes end to end; frame times in seconds, mark times in ms, both from the joined start. */
export function joinTakes(takes: Take[]): Joined {
  let offset = 0;
  const frames: Frame[] = [];
  const marks: Mark[] = [];
  const scenes: Joined["scenes"] = [];
  for (const take of takes) {
    const shift = offset * 1000 - take.start;
    frames.push(...take.frames.map((f) => ({ ...f, t: (f.t + shift) / 1000 })));
    marks.push(...take.marks.map((m) => ({ ...m, t: m.t + shift })));
    const length = (take.end - take.start) / 1000;
    scenes.push({ name: take.name, start: offset, end: offset + length });
    offset += length;
  }
  return { frames, marks, scenes, wall: offset };
}
