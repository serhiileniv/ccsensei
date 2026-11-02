import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS,
  checkDeck,
  checkSlide,
  countWords,
  customProp,
  extractColors,
  firstFontFamily,
  isTokenColor,
  isUpscaled,
  outsideSafeArea,
  parseColor,
  parseMinutes,
  parseTokens,
  pdfPageCount,
  talkMinutes,
} from './rules.ts';
import type { ElementFacts, SlideFacts } from './rules.ts';

const COBALT = { r: 19, g: 53, b: 156, a: 1 };
const tokens = [COBALT, { r: 23, g: 23, b: 26, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }];

const element = (over: Partial<ElementFacts> = {}): ElementFacts => ({
  label: 'h1',
  box: { x: 200, y: 200, width: 400, height: 100 },
  scroll: { width: 400, height: 100 },
  client: { width: 400, height: 100 },
  fontSizePx: 64,
  colors: ['rgb(23, 23, 26)'],
  bleed: false,
  clips: false,
  ...over,
});

const slide = (over: Partial<SlideFacts> = {}): SlideFacts => ({
  index: 1,
  title: 'Title',
  text: 'Short slide text',
  bullets: 0,
  elements: [element()],
  images: [],
  videos: [],
  ...over,
});

const exists = () => true;

test('countWords counts tokens with a letter or digit, ignores symbols', () => {
  assert.equal(countWords('  Hello,  world → 38 × \n'), 3);
  assert.equal(countWords(''), 0);
});

test('parseColor handles hex 3/4/6/8 digits', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('#13359C'), COBALT);
  assert.deepEqual(parseColor('#13359c33'), { ...COBALT, a: 0.2 });
  assert.deepEqual(parseColor('#0008'), { r: 0, g: 0, b: 0, a: 0x88 / 255 });
});

test('parseColor handles rgb/rgba comma and space syntax and transparent', () => {
  assert.deepEqual(parseColor('rgb(19, 53, 156)'), COBALT);
  assert.deepEqual(parseColor('rgba(19,53,156,0.5)'), { ...COBALT, a: 0.5 });
  assert.deepEqual(parseColor('rgb(19 53 156 / 50%)'), { ...COBALT, a: 0.5 });
  assert.deepEqual(parseColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(parseColor('64px'), null);
  assert.equal(parseColor('var(--ink)'), null);
});

test('extractColors finds every color inside gradients and shadows', () => {
  const value = 'radial-gradient(rgba(19, 53, 156, 0.2) 0%, rgba(0, 0, 0, 0) 70%)';
  assert.deepEqual(extractColors(value), [{ ...COBALT, a: 0.2 }, { r: 0, g: 0, b: 0, a: 0 }]);
  assert.deepEqual(extractColors('none'), []);
});

test('parseTokens reads color custom properties from :root only', () => {
  const css = ':root { --ink: #17171a; --gap: 24px; --glow: #13359c33; --font: "Geist"; }\n.x { --other: #f00; }';
  const parsed = parseTokens(css);
  assert.deepEqual([...parsed.keys()], ['--ink', '--glow']);
  assert.deepEqual(parsed.get('--glow'), { ...COBALT, a: 0.2 });
});

test('isTokenColor matches normalized rgb with alpha tolerance; transparent always passes', () => {
  assert.equal(isTokenColor({ r: 19, g: 53, b: 156, a: 1 }, tokens), true);
  assert.equal(isTokenColor({ r: 255, g: 0, b: 0, a: 1 }, tokens), false);
  assert.equal(isTokenColor({ r: 255, g: 0, b: 0, a: 0 }, tokens), true);
  const glowTokens = [{ ...COBALT, a: 0x29 / 255 }];
  assert.equal(isTokenColor({ ...COBALT, a: 0.16 }, glowTokens), true);
});

test('firstFontFamily strips quotes and fallbacks', () => {
  assert.equal(firstFontFamily('"Instrument Serif", Georgia, serif'), 'Instrument Serif');
  assert.equal(firstFontFamily(" Geist , system-ui"), 'Geist');
});

test('outsideSafeArea flags boxes crossing the 64px margin', () => {
  const canvas = LIMITS.canvas;
  assert.equal(outsideSafeArea({ x: 64, y: 64, width: 1792, height: 952 }, canvas, 64), false);
  assert.equal(outsideSafeArea({ x: 63, y: 100, width: 10, height: 10 }, canvas, 64), true);
  assert.equal(outsideSafeArea({ x: 100, y: 1000, width: 10, height: 20 }, canvas, 64), true);
});

test('isUpscaled: raster narrower than its box is upscaled; svg never is', () => {
  assert.equal(isUpscaled({ src: 'a.png', naturalWidth: 800, renderedWidth: 1200 }), true);
  assert.equal(isUpscaled({ src: 'a.png', naturalWidth: 2400, renderedWidth: 1200 }), false);
  assert.equal(isUpscaled({ src: 'img/a.svg', naturalWidth: 100, renderedWidth: 1200 }), false);
});

test('talkMinutes divides words by words-per-minute', () => {
  assert.equal(talkMinutes(390, 130), 3);
});

test('pdfPageCount counts page objects, not the pages tree', () => {
  const pdf = '<< /Type /Pages /Count 2 >> << /Type /Page /Parent 1 0 R >> <</Type/Page/Parent 1 0 R>>';
  assert.equal(pdfPageCount(pdf), 2);
});

test('checkSlide passes a clean slide', () => {
  assert.deepEqual(checkSlide(slide(), { tokens, fileExists: exists }), []);
});

test('checkSlide flags overflow, safe area, small font, words, bullets', () => {
  const bad = slide({
    text: Array(31).fill('word').join(' '),
    bullets: 4,
    elements: [
      element({ label: 'p.long', clips: true, scroll: { width: 400, height: 300 } }),
      element({ label: 'p.edge', box: { x: 10, y: 200, width: 100, height: 40 } }),
      element({ label: 'small', fontSizePx: 18 }),
    ],
  });
  const rules = checkSlide(bad, { tokens, fileExists: exists }).map((v) => v.rule);
  assert.deepEqual(rules.sort(), ['bullets', 'font-size', 'overflow', 'safe-area', 'words']);
});

test('checkSlide ignores safe area for bleed elements and overflow for zero-size inline boxes', () => {
  const ok = slide({
    elements: [
      element({ label: 'video', bleed: true, box: { x: 0, y: 0, width: 1920, height: 1080 } }),
      element({ label: 'span', client: { width: 0, height: 0 }, scroll: { width: 50, height: 20 } }),
    ],
  });
  assert.deepEqual(checkSlide(ok, { tokens, fileExists: exists }), []);
});

test('checkSlide flags non-token colors, broken and upscaled images, missing video assets', () => {
  const bad = slide({
    elements: [element({ colors: ['rgb(255, 0, 0)'] })],
    images: [
      { src: 'img/missing.png', naturalWidth: 0, renderedWidth: 300, complete: true },
      { src: 'img/small.png', naturalWidth: 300, renderedWidth: 900, complete: true },
    ],
    videos: [{ poster: '', sources: ['media/gone.webm'] }],
  });
  const rules = checkSlide(bad, { tokens, fileExists: (p) => !p.includes('gone') }).map((v) => v.rule);
  assert.deepEqual(rules.sort(), ['broken-image', 'color', 'upscaled-image', 'video-missing', 'video-poster']);
});

test('checkDeck flags too many slides and talk time over the limit', () => {
  const rules = checkDeck({ slideCount: 10, notesWords: 400, minutes: 3, pdfPages: 9 }).map((v) => v.rule);
  assert.deepEqual(rules.sort(), ['pdf-pages', 'slide-count', 'talk-time']);
  assert.deepEqual(checkDeck({ slideCount: 9, notesWords: 300, minutes: 3, pdfPages: 9 }), []);
});

test('customProp reads a :root custom property value', () => {
  const css = ':root {\n  --font-ui: "Geist", system-ui;\n  --w: 1920px;\n}';
  assert.equal(customProp(css, '--font-ui'), '"Geist", system-ui');
  assert.equal(customProp(css, '--missing'), null);
});

test('checkSlide ignores ink overflow on non-clipping boxes (tight serif line-height)', () => {
  const ok = slide({ elements: [element({ label: 'h2', clips: false, scroll: { width: 400, height: 130 } })] });
  assert.deepEqual(checkSlide(ok, { tokens, fileExists: exists }), []);
});

test('parseMinutes takes a positive number only', () => {
  assert.equal(parseMinutes('3'), 3);
  assert.equal(parseMinutes('2.5'), 2.5);
  assert.equal(parseMinutes('3m'), null);
  assert.equal(parseMinutes('0'), null);
});
