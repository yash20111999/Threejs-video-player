import { useEffect, useRef } from "react";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useTranscriptStore } from "@/store/useTranscriptStore";
import { findActiveWordIndex } from "@/lib/transcriptUtils";

// Single rAF loop that runs OUTSIDE the React render cycle.
// - Reads video.currentTime every frame (no React subscription, no re-render).
// - Pushes currentTime into the store only ~10x/sec (smooth slider, few renders).
// - Updates activeWordIndex only when the active word actually changes.
// - Honors skipped ranges by seeking past them during playback.
export function useAnimationFrame() {
  const rafRef = useRef<number>(0);
  const lastIndex = useRef<number>(-1);
  const lastPushedTime = useRef<number>(-1);

  useEffect(() => {
    const loop = () => {
      const playback = usePlaybackStore.getState();
      const video = playback.videoEl;

      if (video) {
        const t = video.currentTime;

        // Skip ranges: jump past skipped portions while playing.
        if (playback.isPlaying) {
          const target = useTranscriptStore.getState().getSkipTarget(t);
          if (target !== null && target > t) {
            playback.seekTo(target);
          }
        }

        // Throttle store writes for the timeline to ~10fps.
        if (Math.abs(t - lastPushedTime.current) >= 0.1) {
          lastPushedTime.current = t;
          playback.setCurrentTime(t);
        }

        // Active word: only write to the store on change.
        const transcript = useTranscriptStore.getState().transcript;
        if (transcript) {
          const idx = findActiveWordIndex(transcript.words, video.currentTime);
          if (idx !== lastIndex.current) {
            lastIndex.current = idx;
            useTranscriptStore.getState().setActiveWordIndex(idx);
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
}
