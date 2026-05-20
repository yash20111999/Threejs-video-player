import { create } from "zustand";
import { Transcript, SkippedRange } from "@/lib/types";

interface TranscriptState {
  transcript: Transcript | null;
  activeWordIndex: number;
  skippedRanges: SkippedRange[];

  setTranscript: (t: Transcript) => void;
  setActiveWordIndex: (i: number) => void;
  addSkippedRange: (range: SkippedRange) => void;
  removeSkippedRangeAt: (index: number) => void;
  isWordSkipped: (index: number) => boolean;
  // If `time` falls inside a skipped range (or a chain of adjacent skipped
  // ranges), returns the time to jump to; otherwise null.
  getSkipTarget: (time: number) => number | null;
}

const sortRanges = (ranges: SkippedRange[]) =>
  [...ranges].sort((a, b) => a.startTime - b.startTime);

export const useTranscriptStore = create<TranscriptState>((set, get) => ({
  transcript: null,
  activeWordIndex: -1,
  skippedRanges: [],

  setTranscript: (t) => set({ transcript: t }),
  setActiveWordIndex: (i) => set({ activeWordIndex: i }),

  addSkippedRange: (range) =>
    set((s) => ({ skippedRanges: sortRanges([...s.skippedRanges, range]) })),

  removeSkippedRangeAt: (index) =>
    set((s) => ({
      skippedRanges: s.skippedRanges.filter(
        (r) => !(index >= r.startIndex && index <= r.endIndex)
      ),
    })),

  isWordSkipped: (index) =>
    get().skippedRanges.some(
      (r) => index >= r.startIndex && index <= r.endIndex
    ),

  getSkipTarget: (time) => {
    const ranges = get().skippedRanges;
    let target: number | null = null;
    // Follow chained ranges so back-to-back skips collapse into one jump.
    let cursor = time;
    let advanced = true;
    while (advanced) {
      advanced = false;
      for (const r of ranges) {
        if (cursor >= r.startTime && cursor < r.endTime) {
          cursor = r.endTime;
          target = r.endTime;
          advanced = true;
        }
      }
    }
    return target;
  },
}));
