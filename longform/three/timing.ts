import type { WordTiming } from '../components/KineticCaptions';

/**
 * Finds the start time (in seconds) of the first occurrence of `query` in `words`.
 * Matches case-insensitively after stripping punctuation; supports multi-word phrases.
 * Falls back to `fallbackSec` when `words` is empty or the query is not found.
 */
export function cueAt(
  words: WordTiming[] | undefined,
  query: string,
  fallbackSec: number = 0
): number {
  if (!words || words.length === 0 || !query.trim()) {
    return fallbackSec;
  }
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9']+/g, '');
  const tokens = query.trim().split(/\s+/).map(clean).filter(Boolean);
  if (tokens.length === 0) return fallbackSec;

  for (let i = 0; i <= words.length - tokens.length; i++) {
    let matched = true;
    for (let j = 0; j < tokens.length; j++) {
      if (clean(words[i + j].w) !== tokens[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return words[i].s;
    }
  }
  return fallbackSec;
}

/**
 * Returns [startSec, endSec] spanning from `startQuery` to `endQuery` in `words`.
 */
export function cueRange(
  words: WordTiming[] | undefined,
  startQuery: string,
  endQuery: string,
  fallbackStartSec: number = 0,
  fallbackEndSec: number = fallbackStartSec + 4
): [number, number] {
  const startSec = cueAt(words, startQuery, fallbackStartSec);
  if (!words || words.length === 0 || !endQuery.trim()) {
    return [startSec, Math.max(startSec + 0.5, fallbackEndSec)];
  }
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9']+/g, '');
  const tokens = endQuery.trim().split(/\s+/).map(clean).filter(Boolean);
  if (tokens.length === 0) {
    return [startSec, Math.max(startSec + 0.5, fallbackEndSec)];
  }

  for (let i = 0; i <= words.length - tokens.length; i++) {
    if (words[i].s < startSec - 0.05) continue;
    let matched = true;
    for (let j = 0; j < tokens.length; j++) {
      if (clean(words[i + j].w) !== tokens[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return [startSec, Math.max(startSec + 0.25, words[i + tokens.length - 1].e)];
    }
  }
  return [startSec, Math.max(startSec + 0.5, fallbackEndSec)];
}
