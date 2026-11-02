export const MIN_HOLD_S = 2;
export const WORDS_PER_S = 3;

export interface Cue { start: number; end: number; text: string }

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
export const holdSeconds = (text: string): number => Math.max(MIN_HOLD_S, wordCount(text) / WORDS_PER_S);

/** One cue per captioned scene, cut short by the next cue or the video end. */
export function captionCues(scenes: { caption?: string; start: number }[], videoEnd: number): Cue[] {
  const captioned = scenes.filter((s): s is { caption: string; start: number } => Boolean(s.caption));
  return captioned.map((s, i) => ({
    start: s.start,
    end: Math.min(s.start + holdSeconds(s.caption), captioned[i + 1]?.start ?? Infinity, videoEnd),
    text: s.caption,
  }));
}

export function srtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const pad = (v: number, len = 2): string => String(v).padStart(len, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export const toSrt = (cues: Cue[]): string =>
  cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
