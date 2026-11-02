// Records each scene of ./scenario.ts into frames/<scene>/ (CDP frames + take.json), retrying failed scenes.
// Usage: node record.ts [--check]   env: BASE_URL, HEALTH_URL, RETRIES=2, HEADLESS=1, DSF=2
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { Director } from "./lib/director.ts";
import { OVERLAY_SCRIPT } from "./lib/overlay.ts";
import { checkHealth, formatResult, missingSelector, preflight } from "./lib/preflight.ts";
import type { Manifest, Meta, Scene, Take } from "./lib/types.ts";
import { validateScenario } from "./lib/validate.ts";

const ROOT = import.meta.dirname;
const FRAMES = join(ROOT, "frames");
const VIEW = { width: 1440, height: 810 };
const SCALE = Number(process.env.DSF ?? 2);
const RETRIES = Number(process.env.RETRIES ?? 2);
const CHECK = process.argv.includes("--check");

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function loadScenario(): Promise<{ scenes: Scene[]; meta: Meta }> {
  const path = join(ROOT, "scenario.ts");
  if (!existsSync(path)) fail("no scenario.ts: copy scenario.example.ts to scenario.ts and edit it");
  const mod: unknown = await import(pathToFileURL(path).href);
  const errors = validateScenario(mod);
  if (errors.length) fail(`scenario.ts is invalid:\n- ${errors.join("\n- ")}`);
  return mod as { scenes: Scene[]; meta: Meta };
}

async function openPage(baseUrl: string): Promise<{ browser: Browser; page: Page }> {
  // Headed by default: headless screencast frames can come out at CSS-pixel size.
  // The flags stop macOS throttling an occluded window, so it can sit behind other windows.
  const browser = await chromium.launch({
    headless: process.env.HEADLESS === "1",
    args: [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      `--window-size=${VIEW.width},${VIEW.height + 90}`,
    ],
  });
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, colorScheme: "light" });
  await ctx.addInitScript(OVERLAY_SCRIPT);
  const page = await ctx.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  return { browser, page };
}

async function recordOnce(page: Page, scene: Scene): Promise<Take> {
  const missing = await missingSelector(page, scene);
  if (missing) throw new Error(`selector ${missing} not visible`);
  const d = new Director(page, join(FRAMES, scene.name));
  await d.start(SCALE);
  try {
    await scene.run(d);
  } catch (err) {
    await d.stop(scene.name); // stop the screencast so a retry starts clean
    throw err;
  }
  return d.stop(scene.name);
}

async function recordScene(page: Page, scene: Scene): Promise<Take> {
  for (let attempt = 0; ; attempt++) {
    try {
      const take = await recordOnce(page, scene);
      writeFileSync(join(FRAMES, scene.name, "take.json"), JSON.stringify(take));
      process.stdout.write(`✓ ${scene.name}: ${take.frames.length} frames, ${((take.end - take.start) / 1000).toFixed(1)} s\n`);
      return take;
    } catch (err) {
      await page.screenshot({ path: join(FRAMES, `${scene.name}.failure.png`) }).catch(() => undefined);
      const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
      if (attempt >= RETRIES) throw new Error(`scene "${scene.name}" failed after ${attempt + 1} tries: ${msg}`);
      process.stdout.write(`↻ ${scene.name} failed (${msg}), retry ${attempt + 1}/${RETRIES}\n`);
    }
  }
}

async function main(): Promise<void> {
  const { scenes, meta } = await loadScenario();
  const baseUrl = process.env.BASE_URL ?? meta.url;
  const healthUrl = process.env.HEALTH_URL;
  const unhealthy = healthUrl ? await checkHealth(healthUrl) : null;
  if (unhealthy) fail(`FAIL ${unhealthy}`);
  mkdirSync(FRAMES, { recursive: true });
  const { browser, page } = await openPage(baseUrl);
  try {
    if (CHECK) {
      const result = await preflight(page, scenes, (s) => s.run(new Director(page, null)));
      process.stdout.write(`${formatResult(result)}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    for (const scene of scenes) await recordScene(page, scene);
    const manifest: Manifest = { meta, scenes: scenes.map(({ name, caption, wow }) => ({ name, caption, wow })) };
    writeFileSync(join(FRAMES, "manifest.json"), JSON.stringify(manifest, null, 1));
    process.stdout.write(`recorded ${scenes.length} scenes → ${FRAMES}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
