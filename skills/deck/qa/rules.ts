// Pure QA rules: facts in, violations out. No browser, no fs.

export const LIMITS = {
  canvas: { width: 1920, height: 1080 },
  safeAreaPx: 64,
  minFontPx: 24,
  maxWords: 30,
  maxBullets: 3,
  maxSlides: 9,
  wordsPerMinute: 130,
  alphaTolerance: 0.01,
  // Sub-pixel layout rounding makes scroll exceed client by <1px on clean boxes.
  overflowTolerancePx: 1,
} as const;

export type Rgba = { r: number; g: number; b: number; a: number };
export type Box = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };

export type ElementFacts = {
  label: string;
  box: Box;
  scroll: Size;
  client: Size;
  fontSizePx: number | null; // null when the element has no own text
  colors: string[]; // raw computed values that may contain colors
  bleed: boolean; // full-bleed media/glow, exempt from the safe area
  // Only clipping boxes are checked: on overflow:visible boxes, serif glyph ink above a
  // tight line-height inflates scrollHeight without anything being cut.
  clips: boolean;
};
export type ImageFacts = { src: string; naturalWidth: number; renderedWidth: number; complete: boolean };
export type VideoFacts = { poster: string; sources: string[] };
export type SlideFacts = {
  index: number;
  title: string;
  text: string;
  bullets: number;
  elements: ElementFacts[];
  images: ImageFacts[];
  videos: VideoFacts[];
};
export type Violation = { rule: string; detail: string };

const HEX_COLOR = /#[0-9a-f]{3,8}\b/gi;
const RGB_COLOR = /rgba?\([^)]*\)/gi;
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

export const countWords = (text: string): number =>
  text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;

const parseHex = (hex: string): Rgba | null => {
  const digits = hex.slice(1);
  if (![3, 4, 6, 8].includes(digits.length)) return null;
  const full = digits.length <= 4 ? [...digits].map((d) => d + d).join('') : digits;
  const [r, g, b, a = 255] = full.match(/../g)!.map((pair) => parseInt(pair, 16));
  return { r, g, b, a: a / 255 };
};

const parseAlpha = (raw: string | undefined): number => {
  if (raw === undefined) return 1;
  return raw.endsWith('%') ? parseFloat(raw) / 100 : parseFloat(raw);
};

const parseRgb = (value: string): Rgba | null => {
  const parts = value.replace(/rgba?\(|\)/gi, '').split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const [r, g, b] = parts.slice(0, 3).map(Number);
  return { r, g, b, a: parseAlpha(parts[3]) };
};

export const parseColor = (value: string): Rgba | null => {
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return { ...TRANSPARENT };
  if (/^#[0-9a-f]+$/.test(v)) return parseHex(v);
  if (/^rgba?\(.*\)$/.test(v)) return parseRgb(v);
  return null;
};

export const extractColors = (value: string): Rgba[] => {
  const matches = [...value.matchAll(new RegExp(`${RGB_COLOR.source}|${HEX_COLOR.source}`, 'gi'))];
  return matches.map((m) => parseColor(m[0])).filter((c): c is Rgba => c !== null);
};

export const parseTokens = (css: string): Map<string, Rgba> => {
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
  const entries = [...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map(([, name, value]) => [name, parseColor(value)] as const)
    .filter((entry): entry is readonly [string, Rgba] => entry[1] !== null);
  return new Map(entries);
};

export const isTokenColor = (color: Rgba, tokens: Rgba[]): boolean =>
  color.a === 0 ||
  tokens.some(
    (t) =>
      t.r === color.r &&
      t.g === color.g &&
      t.b === color.b &&
      Math.abs(t.a - color.a) <= LIMITS.alphaTolerance,
  );

export const firstFontFamily = (value: string): string => value.split(',')[0].trim().replace(/["']/g, '');

export const outsideSafeArea = (box: Box, canvas: Size, margin: number): boolean =>
  box.x < margin ||
  box.y < margin ||
  box.x + box.width > canvas.width - margin ||
  box.y + box.height > canvas.height - margin;

export const isUpscaled = (img: { src: string; naturalWidth: number; renderedWidth: number }): boolean =>
  !/\.svg(\?|#|$)/i.test(img.src) && img.naturalWidth < img.renderedWidth;

export const parseMinutes = (value: string): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const talkMinutes = (words: number, wpm: number): number => words / wpm;

export const pdfPageCount = (pdf: string): number => (pdf.match(/\/Type\s*\/Page(?!s)\b/g) ?? []).length;

const overflows = (el: ElementFacts): boolean =>
  el.clips &&
  el.client.width > 0 &&
  (el.scroll.width - el.client.width > LIMITS.overflowTolerancePx ||
    el.scroll.height - el.client.height > LIMITS.overflowTolerancePx);

const formatColor = ({ r, g, b, a }: Rgba): string => `rgba(${r}, ${g}, ${b}, ${+a.toFixed(2)})`;

const elementViolations = (el: ElementFacts, tokens: Rgba[]): Violation[] => {
  const found: Violation[] = [];
  if (overflows(el)) {
    found.push({ rule: 'overflow', detail: `${el.label} content ${el.scroll.width}×${el.scroll.height} > box ${el.client.width}×${el.client.height}` });
  }
  if (!el.bleed && outsideSafeArea(el.box, LIMITS.canvas, LIMITS.safeAreaPx)) {
    const { x, y, width, height } = el.box;
    found.push({ rule: 'safe-area', detail: `${el.label} at ${x},${y} ${width}×${height} crosses ${LIMITS.safeAreaPx}px margin` });
  }
  if (el.fontSizePx !== null && el.fontSizePx < LIMITS.minFontPx) {
    found.push({ rule: 'font-size', detail: `${el.label} ${el.fontSizePx}px < ${LIMITS.minFontPx}px` });
  }
  const offToken = el.colors.flatMap(extractColors).filter((c) => !isTokenColor(c, tokens));
  if (offToken.length > 0) {
    found.push({ rule: 'color', detail: `${el.label} uses ${offToken.map(formatColor).join(', ')}` });
  }
  return found;
};

const imageViolations = (img: ImageFacts): Violation[] => {
  if (!img.complete || img.naturalWidth === 0) return [{ rule: 'broken-image', detail: img.src }];
  if (isUpscaled(img)) {
    return [{ rule: 'upscaled-image', detail: `${img.src} ${img.naturalWidth}px drawn at ${Math.round(img.renderedWidth)}px` }];
  }
  return [];
};

const videoViolations = (video: VideoFacts, fileExists: (path: string) => boolean): Violation[] => {
  const found: Violation[] = [];
  if (!video.poster || !fileExists(video.poster)) found.push({ rule: 'video-poster', detail: video.poster || 'no poster attribute' });
  const missing = video.sources.filter((src) => !fileExists(src));
  if (video.sources.length === 0 || missing.length > 0) {
    found.push({ rule: 'video-missing', detail: missing.join(', ') || 'no source' });
  }
  return found;
};

export const checkSlide = (
  slide: SlideFacts,
  { tokens, fileExists }: { tokens: Rgba[]; fileExists: (path: string) => boolean },
): Violation[] => {
  const words = countWords(slide.text);
  return [
    ...(words > LIMITS.maxWords ? [{ rule: 'words', detail: `${words} words > ${LIMITS.maxWords}` }] : []),
    ...(slide.bullets > LIMITS.maxBullets ? [{ rule: 'bullets', detail: `${slide.bullets} bullets > ${LIMITS.maxBullets}` }] : []),
    ...slide.elements.flatMap((el) => elementViolations(el, tokens)),
    ...slide.images.flatMap(imageViolations),
    ...slide.videos.flatMap((v) => videoViolations(v, fileExists)),
  ];
};

export const checkDeck = (deck: { slideCount: number; notesWords: number; minutes: number; pdfPages: number }): Violation[] => {
  const found: Violation[] = [];
  if (deck.slideCount > LIMITS.maxSlides) found.push({ rule: 'slide-count', detail: `${deck.slideCount} slides > ${LIMITS.maxSlides}` });
  if (deck.pdfPages !== deck.slideCount) found.push({ rule: 'pdf-pages', detail: `PDF has ${deck.pdfPages} pages, deck has ${deck.slideCount} slides` });
  const minutes = talkMinutes(deck.notesWords, LIMITS.wordsPerMinute);
  if (minutes > deck.minutes) found.push({ rule: 'talk-time', detail: `${minutes.toFixed(1)} min of notes > ${deck.minutes} min limit` });
  return found;
};

export const customProp = (css: string, name: string): string | null => {
  const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
  const match = root.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
};
