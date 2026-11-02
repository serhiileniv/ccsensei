// Browser plumbing: open the deck, step slides, screenshots, contact sheet, PDF.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright';

export const PROJECTOR = { width: 960, height: 540 };
const SHEET_COLUMNS = 3;
const SHEET_TILE_WIDTH = 600;
const PDF_LAYOUT_TIMEOUT_MS = 10_000;

declare const Reveal: {
  isReady(): boolean;
  configure(o: object): void;
  slide(h: number): void;
  getTotalSlides(): number;
};

const pad = (n: number) => String(n).padStart(2, '0');
export const slidePng = (out: string, n: number, suffix = '') => join(out, `slide-${pad(n)}${suffix}.png`);

const settle = (page: Page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

export const openDeck = async (browser: Browser, url: string, viewport: { width: number; height: number }) => {
  const page = await browser.newPage({ viewport });
  await page.goto(url);
  await page.waitForFunction(() => typeof Reveal !== 'undefined' && Reveal.isReady());
  // Freeze motion so screenshots and measurements are deterministic.
  await page.evaluate(() => Reveal.configure({ transition: 'none', backgroundTransition: 'none', autoPlayMedia: false }));
  await page.evaluate(() => document.fonts.ready);
  return page;
};

export const goToSlide = async (page: Page, index: number) => {
  await page.evaluate((i) => Reveal.slide(i), index);
  await settle(page);
};

export const slideCount = (page: Page) => page.evaluate(() => Reveal.getTotalSlides());

export const screenshotAll = async (page: Page, count: number, out: string, suffix: string) => {
  for (let i = 0; i < count; i++) {
    await goToSlide(page, i);
    await page.screenshot({ path: slidePng(out, i + 1, suffix) });
  }
};

export const fontLoaded = (page: Page, family: string) =>
  page.evaluate(async (fam) => {
    // fonts.check() is true for families that were never declared, so also require a loaded face.
    // load() rejects with NetworkError when the font file is missing.
    const faces = await document.fonts.load(`400 32px "${fam}"`).catch(() => []);
    return faces.length > 0 && document.fonts.check(`400 32px "${fam}"`);
  }, family);

export const contactSheet = async (browser: Browser, pngs: string[], path: string) => {
  const tiles = pngs
    .map((p, i) => `<figure><img src="data:image/png;base64,${readFileSync(p).toString('base64')}"><figcaption>${i + 1}</figcaption></figure>`)
    .join('');
  const html = `<style>body{margin:0;padding:24px;background:#ececea;font:24px sans-serif;display:grid;
    grid-template-columns:repeat(${SHEET_COLUMNS},${SHEET_TILE_WIDTH}px);gap:24px}figure{margin:0}
    img{width:100%;display:block;border:1px solid #ccc}</style>${tiles}`;
  const page = await browser.newPage({ viewport: { width: SHEET_COLUMNS * (SHEET_TILE_WIDTH + 24) + 24, height: 400 } });
  await page.setContent(html);
  await page.screenshot({ path, fullPage: true });
  await page.close();
};

export const exportPdf = async (browser: Browser, url: string, path: string) => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  // reveal fires pdf-ready once print pages are laid out, well after isReady(). Capture phase
  // on document sees it whether or not it bubbles.
  await page.addInitScript(() =>
    document.addEventListener('pdf-ready', () => document.documentElement.setAttribute('data-pdf-ready', ''), true),
  );
  await page.goto(`${url}?print-pdf`);
  await page.evaluate(() => document.fonts.ready);
  // On timeout we still print; the page-count check reports the mismatch.
  await page.waitForSelector('html[data-pdf-ready]', { state: 'attached', timeout: PDF_LAYOUT_TIMEOUT_MS }).catch(() => {});
  const pdf = await page.pdf({ path, width: '1920px', height: '1080px', printBackground: true });
  await page.close();
  return pdf;
};
