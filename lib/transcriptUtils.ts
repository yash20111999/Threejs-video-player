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

// A token ends a paragraph if its (trimmed) text finishes with a full stop.
const isParagraphEnd = (w: Word) =>
  w.type !== "spacing" && /\.+$/.test(w.text.trim());

// Snap an arbitrary [a, b] selection outward to whole paragraphs: the start
// moves back to the first word after the previous full stop, and the end
// moves forward to the next token that ends with a full stop.
export function expandToParagraph(
  words: Word[],
  a: number,
  b: number
): { startIndex: number; endIndex: number } {
  if (a > b) [a, b] = [b, a];

  let start = a;
  while (start > 0 && !isParagraphEnd(words[start - 1])) start--;
  while (start < b && words[start].type === "spacing") start++;

  let end = b;
  while (end < words.length - 1 && !isParagraphEnd(words[end])) end++;

  return { startIndex: start, endIndex: end };
}
