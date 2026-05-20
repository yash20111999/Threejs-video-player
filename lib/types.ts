export interface Word {
  text: string;
  start: number; // seconds
  end: number; // seconds
  type: string; // "word" | "spacing" | "punctuation"
}

export interface Transcript {
  text: string;
  words: Word[];
}

export interface VideoMetadata {
  videoUrl: string;
  backgroundUrl: string;
  duration: number;
}

export interface PlayerConfig {
  padding: number; // 0–64
  borderRadius: number; // 0–48
}

export interface SkippedRange {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
}
