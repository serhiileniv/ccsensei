import type { Rect, Size } from "./types.ts";

export const EASE_S = 0.6;
export const MAX_ZOOM = 2.2;
/** Share of the frame a spotlit element should fill. */
const FILL = 0.7;

export interface Focus { t: number; holdS: number; scale: number; cx: number; cy: number }
/** a..b in output seconds; cx, cy normalised 0..1. */
export interface ZoomWindow { a: number; b: number; scale: number; cx: number; cy: number }

/** Cosine ease; ease(u) + ease(1 - u) = 1, which makes hand-overs between windows seamless. */
export const ease = (u: number): number => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;

export function fitScale(rect: Rect, view: Size, max = MAX_ZOOM): number {
  const fit = Math.min((FILL * view.width) / rect.width, (FILL * view.height) / rect.height);
  return Math.min(max, Math.max(1, fit));
}

/** Drops a focus superseded within one ease; overlaps the rest by one ease so they pan, not zoom out. */
export function zoomWindows(focus: Focus[]): ZoomWindow[] {
  const sorted = [...focus].sort((p, q) => p.t - q.t);
  const kept = sorted.filter((f, i) => !(sorted[i + 1] && sorted[i + 1].t - f.t < EASE_S));
  return kept.map((f, i) => {
    const natural = f.t + f.holdS + 2 * EASE_S;
    const next = kept[i + 1];
    return { a: f.t, b: next ? Math.min(natural, next.t + EASE_S) : natural, scale: f.scale, cx: f.cx, cy: f.cy };
  });
}

const weight = (w: ZoomWindow, t: number): number => ease(Math.min((t - w.a) / EASE_S, (w.b - t) / EASE_S));

export function zoomAt(t: number, windows: ZoomWindow[]): { scale: number; cx: number; cy: number } {
  return windows.reduce(
    (acc, w) => {
      const p = weight(w, t);
      return { scale: acc.scale + (w.scale - 1) * p, cx: acc.cx + (w.cx - 0.5) * p, cy: acc.cy + (w.cy - 0.5) * p };
    },
    { scale: 1, cx: 0.5, cy: 0.5 },
  );
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function cropAt(t: number, windows: ZoomWindow[], frame: Size): Rect {
  const z = zoomAt(t, windows);
  const width = frame.width / z.scale;
  const height = frame.height / z.scale;
  return {
    x: clamp(z.cx * frame.width - width / 2, 0, frame.width - width),
    y: clamp(z.cy * frame.height - height / 2, 0, frame.height - height),
    width,
    height,
  };
}

/** The same maths as zoomAt, as ffmpeg expressions of the time variable `tv`. */
export function zoomExpr(windows: ZoomWindow[], tv: string): { z: string; cx: string; cy: string } {
  const n = (v: number): string => v.toFixed(3);
  const w = (x: ZoomWindow): string =>
    `(1-cos(PI*min(clip((${tv}-${n(x.a)})/${EASE_S},0,1),clip((${n(x.b)}-${tv})/${EASE_S},0,1))))/2`;
  const sum = (base: string, part: (x: ZoomWindow) => number): string =>
    windows.length ? `${base}+${windows.map((x) => `${n(part(x))}*${w(x)}`).join("+")}` : base;
  return {
    z: windows.length ? sum("1", (x) => x.scale - 1) : "1",
    cx: sum("0.5", (x) => x.cx - 0.5),
    cy: sum("0.5", (x) => x.cy - 0.5),
  };
}
