// Deck QA: node qa.ts <deck/index.html> [--out dir] [--minutes 3]
// Renders PNGs (1920 + 960 projector proxy), a contact sheet and a PDF, then exits 1 on any
// rule in rules.ts. Cannot judge persuasion or the venue projector; rehearse on the real screen.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { collectSlide } from './collect.ts';
import { contactSheet, exportPdf, fontLoaded, goToSlide, openDeck, PROJECTOR, screenshotAll, slideCount, slidePng } from './render.ts';
import { LIMITS, checkDeck, checkSlide, countWords, customProp, firstFontFamily, parseMinutes, parseTokens, pdfPageCount, talkMinutes } from './rules.ts';
import type { Violation } from './rules.ts';

const FONT_TOKENS = ['--font-display', '--font-ui'];
const DEFAULT_MINUTES = 3;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string', default: 'out' }, minutes: { type: 'string', default: String(DEFAULT_MINUTES) } },
});
const deckPath = resolve(positionals[0] ?? join(import.meta.dirname, '../template/index.html'));
const deckDir = dirname(deckPath);
const out = resolve(values.out);
const minutes = parseMinutes(values.minutes);
if (minutes === null) {
  console.error(`--minutes must be a positive number, got "${values.minutes}"`);
  process.exit(2);
}
if (!existsSync(deckPath)) {
  console.error(`Deck not found: ${deckPath}`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const css = readFileSync(join(deckDir, 'deck.css'), 'utf8');
const tokens = [...parseTokens(css).values()];
const brandFonts = FONT_TOKENS.map((name) => customProp(css, name))
  .filter((v): v is string => v !== null)
  .map(firstFontFamily);
// Remote URLs count as missing: the deck must present offline.
const fileExists = (p: string) => !/^[a-z][\w+.-]*:/i.test(p) && existsSync(resolve(deckDir, p));
const url = pathToFileURL(deckPath).href;

const report = (label: string, found: Violation[]) => {
  console.log(`${found.length ? 'FAIL' : 'PASS'}  ${label}`);
  for (const v of found) console.log(`        ${v.rule}: ${v.detail}`);
};

const browser = await chromium.launch();
try {
  const page = await openDeck(browser, url, LIMITS.canvas);
  const count = await slideCount(page);

  const slides = [];
  for (let i = 0; i < count; i++) {
    await goToSlide(page, i);
    await page.screenshot({ path: slidePng(out, i + 1) });
    slides.push(await page.evaluate(collectSlide, i));
  }
  const missingFonts: string[] = [];
  for (const family of brandFonts) if (!(await fontLoaded(page, family))) missingFonts.push(family);

  const projector = await openDeck(browser, url, PROJECTOR);
  await screenshotAll(projector, count, out, '-960');
  await contactSheet(browser, slides.map((s) => slidePng(out, s.index, '-960')), join(out, 'contact-sheet.png'));

  const pdf = await exportPdf(browser, url, join(out, 'deck.pdf'));
  const pdfPages = pdfPageCount(pdf.toString('latin1'));

  const notesWords = slides.reduce((sum, s) => sum + countWords(s.notes), 0);
  const deckViolations: Violation[] = [
    ...checkDeck({ slideCount: count, notesWords, minutes, pdfPages }),
    ...missingFonts.map((f) => ({ rule: 'font-not-loaded', detail: f })),
  ];

  let failed = deckViolations.length > 0;
  for (const slide of slides) {
    const found = checkSlide(slide, { tokens, fileExists });
    failed ||= found.length > 0;
    report(`slide ${slide.index} "${slide.title}" (${countWords(slide.text)} words)`, found);
  }
  report(`deck: ${count} slides, PDF ${pdfPages} pages, fonts ${brandFonts.join(' + ')}`, deckViolations);
  const talk = talkMinutes(notesWords, LIMITS.wordsPerMinute);
  console.log(`Talk time: ${talk.toFixed(1)} min (${notesWords} note words at ${LIMITS.wordsPerMinute} wpm), limit ${minutes} min`);
  console.log(`Contrast (axe): skipped, not bundled. Output: ${out}`);
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser.close();
}
