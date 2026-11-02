// Turns frames/ into out/demo.mp4, demo-vertical.mp4, demo.gif, poster.png and demo.srt.
// Speed ramps fit MAX_S, zoom is a crop in post (zoompan), captions and cards are HTML rendered to PNG.
// Usage: node render.ts   env: MAX_S=120, PUBLIC_URL, REPLAY=0|1 (default: as recorded)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { caption, endCard, replayChip, replayOn, speedBadge, titleCard } from "./lib/cards.ts";
import { captionCues, toSrt } from "./lib/captions.ts";
import { FPS, ffmpeg, type Overlay, overlayChain, overlayInputs, probeDuration, writeConcat } from "./lib/ffmpeg.ts";
import { lint } from "./lib/lint.ts";
import { fastSegments, fitSpeeds, joinTakes, toOutput } from "./lib/timeline.ts";
import type { Manifest, Size, Take } from "./lib/types.ts";
import { zoomExpr, zoomWindows, type ZoomWindow } from "./lib/zoom.ts";

const ROOT = import.meta.dirname;
const FRAMES = join(ROOT, "frames");
const OUT = join(ROOT, "out");
const CARDS = join(OUT, "cards");
const WIDE: Size = { width: 1920, height: 1080 };
const TALL: Size = { width: 1080, height: 1920 };
const TITLE_S = 3;
const END_S = 3.5;
const XFADE_S = 0.6;
const LEAD_S = TITLE_S - XFADE_S;
const GIF_S = 10;
const POSTER_OFFSET_S = 1.5;
if (!existsSync(join(FRAMES, "manifest.json"))) {
  process.stderr.write("no frames/manifest.json: run `npm run record` first\n");
  process.exit(1);
}
const manifest: Manifest = JSON.parse(readFileSync(join(FRAMES, "manifest.json"), "utf8"));
const takes: Take[] = manifest.scenes.map((s) => JSON.parse(readFileSync(join(FRAMES, s.name, "take.json"), "utf8")));
const maxS = Number(process.env.MAX_S ?? manifest.meta.maxSeconds ?? 120);
const REPLAY = replayOn(process.env.REPLAY, manifest.replay);

/** Renders HTML snippets to PNGs at `size`; returns their paths. */
async function renderPngs(items: { name: string; html: string }[], size: Size): Promise<string[]> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size.width / 2, height: size.height / 2 }, deviceScaleFactor: 2 });
  const paths: string[] = [];
  for (const it of items) {
    const path = join(CARDS, `${it.name}.png`);
    await page.setContent(it.html);
    await page.screenshot({ path, omitBackground: true });
    paths.push(path);
  }
  await browser.close();
  return paths;
}

function focusWindows(segs: ReturnType<typeof fitSpeeds>["segs"], marks: Take["marks"], view: Size): ZoomWindow[] {
  const focus = marks.flatMap((m) => {
    if (m.kind !== "focus") return [];
    const t = toOutput(m.t / 1000, segs);
    const holdS = toOutput((m.t + m.holdMs) / 1000, segs) - t;
    const cx = (m.rect.x + m.rect.width / 2) / view.width;
    const cy = (m.rect.y + m.rect.height / 2) / view.height;
    return [{ t, holdS, scale: m.scale, cx, cy }];
  });
  return zoomWindows(focus);
}

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(CARDS, { recursive: true });
  const joined = joinTakes(takes);
  const budget = maxS - TITLE_S - END_S + 2 * XFADE_S;
  const fit = fitSpeeds(fastSegments(joined.marks), joined.wall, budget);
  const segs = fit.segs;
  const concat = join(OUT, "frames.ffconcat");
  const mainS = writeConcat(joined.frames, joined.wall, segs, concat);
  const windows = focusWindows(segs, joined.marks, takes[0].viewport);

  const starts = joined.scenes.map((s, i) => ({ ...manifest.scenes[i], start: toOutput(s.start, segs) }));
  const cues = captionCues(starts, mainS);
  const warnings = lint(starts.map((s) => ({ ...s, start: s.start + LEAD_S })));
  if (fit.overBudget) warnings.push(`over budget even at max speed: main part ${mainS.toFixed(1)} s`);
  for (const w of warnings) process.stdout.write(`warn: ${w}\n`);

  writeFileSync(join(OUT, "demo.srt"), toSrt(cues.map((c) => ({ ...c, start: c.start + LEAD_S, end: c.end + LEAD_S }))));
  const publicUrl = process.env.PUBLIC_URL ?? manifest.meta.url;
  const speeds = [...new Set(segs.map((s) => s.speed))];
  const overlayItems = [
    ...cues.map((c, i) => ({ name: `caption_${i}`, html: caption(c.text) })),
    ...speeds.map((s) => ({ name: `speed_${s}`, html: speedBadge(s) })),
  ];
  const timing = [...cues.map((c) => ({ a: c.start, b: c.end })), ...segs.map((s) => ({ a: toOutput(s.a, segs), b: toOutput(s.b, segs) }))];
  const speedPng = (s: number): number => cues.length + speeds.indexOf(s);
  const timed = (pngs: string[]): Overlay[] =>
    timing.map((t, i) => ({ ...t, png: pngs[i < cues.length ? i : speedPng(segs[i - cues.length].speed)] }));

  const [title, end, ...wide] = await renderPngs(
    [{ name: "title", html: titleCard(manifest.meta) }, { name: "end", html: endCard(manifest.meta, publicUrl) }, ...overlayItems,
      { name: "replay", html: replayChip() }],
    WIDE,
  );
  const tall = await renderPngs([...overlayItems, { name: "replay_tall", html: replayChip() }].map((x) => ({ ...x, name: `${x.name}_tall` })), TALL);

  const total = LEAD_S + mainS + END_S - XFADE_S;
  renderWide(concat, mainS, total, windows, title, end, timed(wide.slice(0, -1)), wide[wide.length - 1]);
  renderTall(concat, mainS, windows, timed(tall.slice(0, -1)), tall[tall.length - 1]);

  const mp4 = join(OUT, "demo.mp4");
  const wowAt = LEAD_S + (starts.find((s) => s.wow) ?? starts[0]).start;
  ffmpeg(["-ss", (wowAt + POSTER_OFFSET_S).toFixed(2), "-i", mp4, "-frames:v", "1", join(OUT, "poster.png")]);
  ffmpeg(["-ss", wowAt.toFixed(2), "-t", `${GIF_S}`, "-i", mp4, "-vf",
    "fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a",
    join(OUT, "demo.gif")]);
  const got = probeDuration(mp4);
  if (got > maxS) process.stdout.write(`warn: video is ${got.toFixed(1)} s, over the ${maxS} s limit\n`);
  process.stdout.write(`wall ${joined.wall.toFixed(1)} s → video ${got.toFixed(1)} s · speeds ${speeds.join(", ") || "none"} · ${OUT}\n`);
}

function renderWide(concat: string, mainS: number, total: number, windows: ZoomWindow[], title: string, end: string, overlays: Overlay[], chip: string): void {
  const z = zoomExpr(windows, "it");
  const inputs = ["-f", "concat", "-safe", "0", "-i", concat,
    ...overlayInputs([title], TITLE_S), ...overlayInputs([end], END_S), ...overlayInputs(overlays.map((o) => o.png), mainS),
    ...(REPLAY ? overlayInputs([chip], total) : [])];
  const { width: W, height: H } = WIDE;
  const zoom = `zoompan=z='${z.z}':x='clip((${z.cx})*iw-iw/zoom/2,0,iw-iw/zoom)':y='clip((${z.cy})*ih-ih/zoom/2,0,ih-ih/zoom)':d=1:s=${W}x${H}:fps=${FPS}`;
  const chain = overlayChain("m0", overlays, 3, "m");
  const chipIdx = 3 + overlays.length;
  const f = [
    `[0:v]fps=${FPS},scale=${W * 2}:${H * 2}:flags=lanczos,${zoom},setsar=1,format=yuv420p[m0]`,
    ...chain.filters,
    `[${chain.out}]format=yuv420p,settb=AVTB[main]`,
    `[1:v]scale=${W}:${H},setsar=1,format=yuv420p,settb=AVTB[t]`,
    `[2:v]scale=${W}:${H},setsar=1,format=yuv420p,settb=AVTB[e]`,
    `[t][main]xfade=transition=fade:duration=${XFADE_S}:offset=${LEAD_S.toFixed(3)}[tm]`,
    `[tm][e]xfade=transition=fade:duration=${XFADE_S}:offset=${(LEAD_S + mainS - XFADE_S).toFixed(3)},format=yuv420p[v0]`,
    REPLAY ? `[v0][${chipIdx}:v]overlay=0:0:format=auto,format=yuv420p[v]` : `[v0]null[v]`,
  ];
  encode(inputs, f, join(OUT, "demo.mp4"));
}

/** 9:16 cut of the main part; the crop window pans with the focus centre. */
function renderTall(concat: string, mainS: number, windows: ZoomWindow[], overlays: Overlay[], chip: string): void {
  const z = zoomExpr(windows, "t");
  const inputs = ["-f", "concat", "-safe", "0", "-i", concat, ...overlayInputs(overlays.map((o) => o.png), mainS),
    ...(REPLAY ? overlayInputs([chip], mainS) : [])];
  const chain = overlayChain("m0", overlays, 1, "m");
  const f = [
    `[0:v]fps=${FPS},crop=w='trunc(ih*9/16/2)*2':h=ih:x='clip((${z.cx})*iw-ow/2,0,iw-ow)':y=0,scale=${TALL.width}:${TALL.height}:flags=lanczos,setsar=1,format=yuv420p[m0]`,
    ...chain.filters,
    REPLAY ? `[${chain.out}][${1 + overlays.length}:v]overlay=0:0:format=auto,format=yuv420p[v]` : `[${chain.out}]format=yuv420p[v]`,
  ];
  encode(inputs, f, join(OUT, "demo-vertical.mp4"));
}

function encode(inputs: string[], filters: string[], out: string): void {
  ffmpeg([...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-c:v", "libx264", "-preset", "medium",
    "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", `${FPS}`, out]);
}

await main();
