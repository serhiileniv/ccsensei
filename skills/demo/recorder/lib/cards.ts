// HTML for title/end cards, captions and chips, rendered to PNG by Playwright
// (stock ffmpeg builds often lack drawtext, and HTML gives real typography). Sizes in vmin so one
// template serves 16:9 and 9:16. Palette: light paper, near-black ink, one cobalt accent.
import type { Meta } from "./types.ts";

const SERIF = `"Iowan Old Style", "Charter", Georgia, serif`;
const SANS = `-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif`;
const PAPER = "#f6f5f1";
const INK = "#111111";
const ACCENT = "#1f4fd8";

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BASE = `*{margin:0;box-sizing:border-box}html,body{width:100vw;height:100vh;font-family:${SANS};-webkit-font-smoothing:antialiased}`;
const TRANSPARENT = `html,body{background:transparent}`;

function card(heading: string, line: string, foot: string): string {
  return `<style>${BASE}
body{background:${PAPER};color:${INK};display:flex;flex-direction:column;justify-content:center;padding:0 10vw;
background-image:linear-gradient(${INK}14 1px,transparent 1px),linear-gradient(90deg,${INK}14 1px,transparent 1px);background-size:8vmin 8vmin}
h1{font-family:${SERIF};font-size:14vmin;font-weight:600;letter-spacing:-.02em;line-height:1}
p{font-size:4.4vmin;margin-top:3vmin;max-width:70vw;line-height:1.3}
.f{margin-top:6vmin;font-size:3.6vmin;font-weight:600;color:${ACCENT}}
</style><body><h1>${esc(heading)}</h1>${line ? `<p>${esc(line)}</p>` : ""}${foot ? `<div class="f">${esc(foot)}</div>` : ""}</body>`;
}

export const titleCard = (meta: Meta): string => card(meta.title, meta.tagline ?? "", "");
export const endCard = (meta: Meta, url: string): string => card(meta.title, meta.tagline ?? "", url);

export function caption(text: string): string {
  return `<style>${BASE}${TRANSPARENT}
.c{position:absolute;left:4vmin;right:4vmin;bottom:5vmin;display:flex;justify-content:center}
.t{padding:2vmin 3.2vmin;border-radius:1.6vmin;background:${PAPER}f2;color:${INK};border-left:.8vmin solid ${ACCENT};
font-size:4.4vmin;font-weight:650;letter-spacing:-.01em;line-height:1.25;box-shadow:0 2vmin 5vmin rgba(0,0,0,.18);max-width:92vw}
</style><body><div class="c"><div class="t">${esc(text)}</div></div></body>`;
}

function chip(text: string, corner: string): string {
  return `<style>${BASE}${TRANSPARENT}
.b{position:absolute;${corner};padding:1vmin 2vmin;border-radius:99px;background:rgba(17,17,17,.82);color:#fff;font-size:2.4vmin;font-weight:600}
</style><body><div class="b">${esc(text)}</div></body>`;
}

export const speedBadge = (speed: number): string => chip(`▶▶ ${speed}×`, "right:3vmin;top:3vmin");
export const replayChip = (): string => chip("Replay of a live run", "left:3vmin;top:3vmin");
/** REPLAY env wins when set; otherwise the flag record.ts saved, so every render of a replayed take keeps the chip. */
export const replayOn = (env: string | undefined, recorded: boolean | undefined): boolean =>
  env === undefined ? recorded === true : env === "1";
