import { Word } from "./types";

// Binary search over word-level timestamps. Returns the index of the token
// whose [start, end) interval contains `currentTime`, or the nearest preceding
// token so the highlight never blanks out between two words.
export function findActiveWordIndex(words: Word[], currentTime: number): number {
  if (words.length === 0) return -1;

  let lo = 0;
  let hi = words.length - 1;
  let candidate = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const w = words[mid];

    if (currentTime < w.start) {
      hi = mid - 1;
    } else if (currentTime >= w.end) {
      candidate = mid;
      lo = mid + 1;
    } else {
      return mid; // exact hit
    }
  }

  return candidate;
}
