import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CDPSession, Locator, Page } from "playwright";
import type { Frame, Mark, Rect, Take } from "./types.ts";
import { fitScale } from "./zoom.ts";

const MOVE_HZ = 60;
const CLICK_ZOOM = 1.3;
const JPEG_QUALITY = 82;
const VISIBLE_TIMEOUT_MS = 30_000;

type Target = Locator | string;

/** Drives the page like a human; when given a frames dir, records CDP frames and focus/fast marks for render. */
export class Director {
  readonly page: Page;
  private readonly dir: string | null;
  private readonly frames: Frame[] = [];
  private readonly marks: Mark[] = [];
  private mouse = { x: 0, y: 0 };
  private cdp: CDPSession | null = null;
  private startedAt = 0;

  constructor(page: Page, dir: string | null) {
    this.page = page;
    this.dir = dir;
  }

  private get view(): { width: number; height: number } {
    return this.page.viewportSize() ?? { width: 1440, height: 810 };
  }

  async start(scale: number): Promise<void> {
    this.mouse = { x: this.view.width / 2, y: this.view.height / 2 };
    this.startedAt = Date.now();
    if (!this.dir) return;
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    // Raw CDP screencast: Playwright's own screencast caps frames at CSS-pixel size; CDP gives device pixels.
    const cdp = await this.page.context().newCDPSession(this.page);
    let n = 0;
    cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
      const file = join(this.dir ?? "", `${String(n++).padStart(6, "0")}.jpg`);
      writeFileSync(file, Buffer.from(data, "base64"));
      this.frames.push({ file, t: Date.now() });
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
    });
    const { width, height } = this.view;
    await cdp.send("Page.startScreencast", {
      format: "jpeg", quality: JPEG_QUALITY, maxWidth: width * scale, maxHeight: height * scale, everyNthFrame: 1,
    });
    this.cdp = cdp;
  }

  async stop(name: string): Promise<Take> {
    if (this.cdp) {
      await this.cdp.send("Page.stopScreencast");
      await this.cdp.detach();
    }
    return { name, viewport: this.view, start: this.startedAt, end: Date.now(), frames: this.frames, marks: this.marks };
  }

  private resolve(target: Target): Locator {
    return typeof target === "string" ? this.page.locator(target).first() : target;
  }

  private async box(target: Target): Promise<Rect> {
    const box = await this.resolve(target).boundingBox();
    if (!box) throw new Error(`no bounding box for ${String(target)}`);
    return box;
  }

  private focus(rect: Rect, scale: number, holdMs: number): void {
    this.marks.push({ t: Date.now(), kind: "focus", rect, scale, holdMs });
  }

  /** Waiting segments (streaming, loading) get sped up in render. */
  fast(on: boolean, speed?: number): void {
    this.marks.push({ t: Date.now(), kind: "fast", on, speed });
  }

  pause(ms: number): Promise<void> {
    return this.page.waitForTimeout(ms);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(new URL(path, this.page.url()).toString(), { waitUntil: "networkidle" });
  }

  /** Eased mouse glide with a slight arc; duration scales with distance. */
  async glide(x: number, y: number): Promise<void> {
    const { x: x0, y: y0 } = this.mouse;
    const dist = Math.hypot(x - x0, y - y0);
    const ms = Math.min(1100, Math.max(350, dist * 0.9));
    const steps = Math.max(8, Math.round((ms / 1000) * MOVE_HZ));
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const arc = Math.sin(p * Math.PI) * Math.min(40, dist * 0.06);
      await this.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e - arc);
      await this.page.waitForTimeout(1000 / MOVE_HZ);
    }
    this.mouse = { x, y };
  }

  async hover(target: Target): Promise<void> {
    const loc = this.resolve(target);
    await loc.waitFor({ state: "visible", timeout: VISIBLE_TIMEOUT_MS });
    await loc.scrollIntoViewIfNeeded();
    const b = await this.box(loc);
    await this.glide(b.x + b.width / 2, b.y + Math.min(b.height / 2, 22));
  }

  async click(target: Target, after = 700): Promise<void> {
    await this.hover(target);
    this.focus(await this.box(target), CLICK_ZOOM, 220 + after);
    await this.pause(220);
    await this.page.mouse.down();
    await this.pause(90);
    await this.page.mouse.up();
    await this.pause(after);
  }

  /** Clicks the field, then types like a person. */
  async type(target: Target, text: string, delayMs = 45): Promise<void> {
    await this.click(target, 200);
    await this.page.keyboard.type(text, { delay: delayMs });
  }

  /** Smooth wheel scroll over whatever is under the cursor. */
  async scroll(dy: number, over?: Target): Promise<void> {
    if (over) await this.hover(over);
    const step = Math.sign(dy) * 40;
    for (let done = 0; Math.abs(done) < Math.abs(dy); done += step) {
      await this.page.mouse.wheel(0, step);
      await this.page.waitForTimeout(16);
    }
    await this.pause(400);
  }

  /** Marks a zoom onto the element for render; the page itself is untouched. */
  async spotlight(target: Target, holdMs = 2200, scale?: number): Promise<void> {
    await this.resolve(target).scrollIntoViewIfNeeded();
    const rect = await this.box(target);
    this.focus(rect, scale ?? fitScale(rect, this.view), holdMs);
    await this.pause(holdMs + 1200);
  }
}
