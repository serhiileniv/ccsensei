// Runs inside the page (serialized by page.evaluate): reads raw DOM facts for one slide.
// Must stay self-contained: no imports, no closures over Node values.
import type { SlideFacts } from './rules.ts';

declare const Reveal: { getSlides(): HTMLElement[] };

export const collectSlide = (index: number): SlideFacts & { notes: string } => {
  const section = Reveal.getSlides()[index];
  const root = (section.querySelector('.slide') as HTMLElement | null) ?? section;
  const origin = root.getBoundingClientRect();

  const ownText = (el: Element) =>
    [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');

  const colorsOf = (el: Element, hasText: boolean): string[] => {
    const cs = getComputedStyle(el);
    const sides = ['top', 'right', 'bottom', 'left'];
    return [
      hasText ? cs.color : '',
      cs.backgroundColor,
      cs.backgroundImage === 'none' ? '' : cs.backgroundImage,
      cs.boxShadow === 'none' ? '' : cs.boxShadow,
      ...sides.map((s) => (parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 ? cs.getPropertyValue(`border-${s}-color`) : '')),
    ].filter(Boolean);
  };

  // Skip notes, video fallback content (never rendered) and anything without a box.
  const rendered = [root, ...root.querySelectorAll('*')].filter((el) => {
    if (el.closest('aside.notes') || el.parentElement?.closest('video')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) as HTMLElement[];

  const elements = rendered.map((el) => {
    const r = el.getBoundingClientRect();
    const hasText = ownText(el);
    const name = `${el.tagName.toLowerCase()}${el.classList.length ? '.' + [...el.classList].join('.') : ''}`;
    const snippet = hasText ? ` "${el.textContent!.trim().slice(0, 24)}"` : '';
    return {
      label: name + snippet,
      box: { x: Math.round(r.left - origin.left), y: Math.round(r.top - origin.top), width: Math.round(r.width), height: Math.round(r.height) },
      scroll: { width: el.scrollWidth, height: el.scrollHeight },
      client: { width: el.clientWidth, height: el.clientHeight },
      fontSizePx: hasText ? parseFloat(getComputedStyle(el).fontSize) : null,
      colors: colorsOf(el, hasText),
      bleed: el === root || el.closest('[data-bleed]') !== null,
      clips: (['overflowX', 'overflowY'] as const).some((k) => getComputedStyle(el)[k] !== 'visible'),
    };
  });

  const images = [...root.querySelectorAll('img')].map((img) => ({
    src: img.getAttribute('src') ?? '',
    naturalWidth: img.naturalWidth,
    renderedWidth: img.getBoundingClientRect().width,
    complete: img.complete,
  }));

  const videos = [...root.querySelectorAll('video')].map((v) => ({
    poster: v.getAttribute('poster') ?? '',
    sources: [v.getAttribute('src'), ...[...v.querySelectorAll('source')].map((s) => s.getAttribute('src'))].filter(
      (s): s is string => Boolean(s),
    ),
  }));

  const heading = root.querySelector('h1, h2');
  return {
    index: index + 1,
    title: section.dataset.title ?? heading?.textContent?.trim() ?? '',
    text: root.innerText,
    bullets: root.querySelectorAll('li').length,
    elements,
    images,
    videos,
    notes: section.querySelector('aside.notes')?.textContent ?? '',
  };
};
