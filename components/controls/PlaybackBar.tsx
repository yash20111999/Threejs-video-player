"use client";

import { useMemo } from "react";
import { usePlaybackStore } from "@/store/usePlaybackStore";

function formatTime(s: number) {
  if (!Number.isFinite(s)) s = 0;
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${sec}`;
}

const TICK_STEP = 15; // seconds between timeline labels

export default function PlaybackBar() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const togglePlay = usePlaybackStore((s) => s.togglePlay);
  const seekTo = usePlaybackStore((s) => s.seekTo);

  const max = duration || 100;
  const progress = Math.min(100, Math.max(0, (currentTime / max) * 100));

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= max; t += TICK_STEP) out.push(t);
    return out;
  }, [max]);

  return (
    <div className="border-t border-edge bg-surface px-8 py-4">
      {/* Play + time, centered */}
      <div className="mb-2 flex items-center justify-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accentfg transition-opacity hover:opacity-90"
        >
          {isPlaying ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-0.5"
            >
              <path d="M7 5v14l12-7z" />
            </svg>
          )}
        </button>
        <span className="font-mono text-xs text-muted">
          <span className="text-fg">{formatTime(currentTime)}</span> /{" "}
          {formatTime(duration)}
        </span>
      </div>

      {/* Timeline */}
      <div className="select-none">
        <div className="mb-1 flex justify-between px-0.5">
          {ticks.map((t) => (
            <span key={t} className="font-mono text-[10px] text-muted">
              {formatTime(t)}
            </span>
          ))}
        </div>

        <div className="relative h-4">
          {/* track */}
          <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-track" />
          {/* progress fill */}
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
            style={{ width: `${progress}%` }}
          />
          {/* playhead dot */}
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow"
            style={{ left: `${progress}%` }}
          />
          {/* invisible scrub input on top */}
          <input
            type="range"
            min={0}
            max={max}
            step={0.05}
            value={currentTime}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Seek"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>
    </div>
  );
}
