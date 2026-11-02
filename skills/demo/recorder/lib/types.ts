import type { Director } from "./director.ts";

export interface Rect { x: number; y: number; width: number; height: number }
export interface Size { width: number; height: number }

export interface Scene {
  name: string;
  run: (d: Director) => Promise<void>;
  caption?: string;
  /** Selectors that must be visible when the scene starts; checked by --check and before each take. */
  expect?: string[];
  wow?: boolean;
}

export interface Meta { title: string; tagline?: string; url: string; maxSeconds?: number }

export interface Frame { file: string; t: number }
export type Mark =
  | { t: number; kind: "fast"; on: boolean; speed?: number }
  | { t: number; kind: "focus"; rect: Rect; scale: number; holdMs: number };

/** One recorded scene; times are epoch ms. */
export interface Take { name: string; viewport: Size; start: number; end: number; frames: Frame[]; marks: Mark[] }

/** What record.ts hands to render.ts (scenario functions stripped). */
export interface Manifest { meta: Meta; scenes: { name: string; caption?: string; wow?: boolean }[] }
