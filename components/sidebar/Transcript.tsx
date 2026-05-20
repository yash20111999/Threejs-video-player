"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranscriptStore } from "@/store/useTranscriptStore";
import { WordChunk } from "./WordChunk";

// Subscribes to activeWordIndex in isolation and scrolls the active word into
// view, so the heavy transcript list never re-renders for scrolling.
function AutoScroller({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const activeWordIndex = useTranscriptStore((s) => s.activeWordIndex);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeWordIndex < 0) return;
    const el = container.querySelector<HTMLElement>(
      `[data-idx="${activeWordIndex}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeWordIndex, containerRef]);
  return null;
}

export default function Transcript() {
  const transcript = useTranscriptStore((s) => s.transcript);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    const onSelChange = () => {
      const sel = window.getSelection();
      setHasSelection(!!sel && !sel.isCollapsed);
    };
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  const skipSelection = useCallback(() => {
    const sel = window.getSelection();
    const t = useTranscriptStore.getState().transcript;
    if (!sel || sel.isCollapsed || !t) return;

    const range = sel.getRangeAt(0);
    const startEl = (
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as HTMLElement)
    )?.closest<HTMLElement>("[data-idx]");
    const endEl = (
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement
        : (range.endContainer as HTMLElement)
    )?.closest<HTMLElement>("[data-idx]");

    if (!startEl || !endEl) return;
    let a = Number(startEl.dataset.idx);
    let b = Number(endEl.dataset.idx);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    if (a > b) [a, b] = [b, a];

    const words = t.words;
    // Trim leading/trailing spacing tokens so the range maps to real words.
    while (a < b && words[a].type === "spacing") a++;
    while (b > a && words[b].type === "spacing") b--;

    useTranscriptStore.getState().addSkippedRange({
      startIndex: a,
      endIndex: b,
      startTime: words[a].start,
      endTime: words[b].end,
    });
    sel.removeAllRanges();
    setHasSelection(false);
  }, []);

  if (!transcript) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted">
        Loading transcript…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          Script
        </span>
        <button
          onClick={skipSelection}
          disabled={!hasSelection}
          className="flex items-center gap-1 rounded-md border border-edge bg-surface px-2.5 py-1 text-xs font-medium text-fg shadow-sm transition-colors enabled:hover:bg-surface2 enabled:hover:text-heading disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>⤳</span> Skip
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 select-text overflow-y-auto px-4 py-4 text-[15px] leading-8 text-fg"
      >
        {transcript.words.map((word, i) => (
          <WordChunk key={i} word={word} index={i} />
        ))}
      </div>

      <AutoScroller containerRef={containerRef} />
    </div>
  );
}
