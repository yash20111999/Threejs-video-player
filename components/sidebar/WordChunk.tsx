"use client";

import { memo } from "react";
import { Word } from "@/lib/types";
import { useTranscriptStore } from "@/store/useTranscriptStore";
import { usePlaybackStore } from "@/store/usePlaybackStore";

interface WordChunkProps {
  word: Word;
  index: number;
}

// Each chunk subscribes only to its own "am I active / skipped?" booleans.
// When the active word changes, Zustand re-runs every selector but only the
// two chunks whose boolean flipped actually re-render.
function WordChunkBase({ word, index }: WordChunkProps) {
  const isActive = useTranscriptStore((s) => s.activeWordIndex === index);
  const isSkipped = useTranscriptStore((s) =>
    s.skippedRanges.some(
      (r) => index >= r.startIndex && index <= r.endIndex
    )
  );

  // Whitespace tokens: keep them selectable but never styled.
  if (word.type === "spacing") {
    return (
      <span data-idx={index} className={isSkipped ? "line-through opacity-40" : ""}>
        {word.text}
      </span>
    );
  }

  const handleClick = () => {
    if (isSkipped) {
      useTranscriptStore.getState().removeSkippedRangeAt(index);
    } else {
      usePlaybackStore.getState().seekTo(word.start);
    }
  };

  const className = [
    "cursor-pointer rounded px-0.5 transition-colors duration-100",
    isSkipped
      ? "line-through text-muted decoration-muted"
      : isActive
        ? "bg-highlight text-highlightfg"
        : "hover:bg-muted/20",
  ].join(" ");

  return (
    <span
      data-idx={index}
      data-active={isActive ? "1" : undefined}
      onClick={handleClick}
      className={className}
      title={
        isSkipped
          ? "Click to unskip"
          : `Seek to ${word.start.toFixed(2)}s`
      }
    >
      {word.text}
    </span>
  );
}

export const WordChunk = memo(WordChunkBase);
