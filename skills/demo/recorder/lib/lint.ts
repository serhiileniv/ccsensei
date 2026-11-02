import { wordCount } from "./captions.ts";

export const WOW_BY_S = 15;
export const MAX_CAPTION_WORDS = 8;

/** `start` is the scene's start in the final video, in seconds. */
export function lint(scenes: { name: string; start: number; caption?: string; wow?: boolean }[]): string[] {
  const wow = scenes.find((s) => s.wow);
  const wowWarnings = !wow
    ? ["no scene is flagged wow: true"]
    : wow.start > WOW_BY_S
      ? [`first wow "${wow.name}" starts at ${wow.start.toFixed(1)} s (aim for ≤ ${WOW_BY_S} s)`]
      : [];
  const captionWarnings = scenes
    .filter((s) => s.caption && wordCount(s.caption) > MAX_CAPTION_WORDS)
    .map((s) => `caption of "${s.name}" has ${wordCount(s.caption ?? "")} words (max ${MAX_CAPTION_WORDS})`);
  return [...wowWarnings, ...captionWarnings];
}
