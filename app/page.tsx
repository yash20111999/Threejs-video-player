"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePlaybackStore } from "@/store/usePlaybackStore";
import { useTranscriptStore } from "@/store/useTranscriptStore";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import type { Transcript, VideoMetadata } from "@/lib/types";
import TranscriptPanel from "@/components/sidebar/Transcript";
import VideoControls from "@/components/sidebar/VideoControls";
import PlaybackBar from "@/components/controls/PlaybackBar";
import ThemeToggle from "@/components/theme/ThemeToggle";

// Three.js touches window/WebGL → never server-render it.
const ThreePlayer = dynamic(
  () => import("@/components/player/ThreePlayer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface2">
        <span className="text-sm text-muted">Loading player…</span>
      </div>
    ),
  }
);

export default function Home() {
  const setTranscript = useTranscriptStore((s) => s.setTranscript);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  useAnimationFrame();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/transcript").then((r) => r.json() as Promise<Transcript>),
      fetch("/api/metadata").then((r) => r.json() as Promise<VideoMetadata>),
    ]).then(([transcript, meta]) => {
      if (cancelled) return;
      setTranscript(transcript);
      setMetadata(meta);
    });
    return () => {
      cancelled = true;
    };
  }, [setTranscript]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "BUTTON" || tag === "TEXTAREA") return;
        e.preventDefault();
        usePlaybackStore.getState().togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden border-r border-edge bg-surface">
          <TranscriptPanel />
          <VideoControls />
        </aside>

        <section className="relative flex flex-1 flex-col overflow-hidden">
          <div className="absolute right-4 top-4 z-10">
            <ThemeToggle />
          </div>
          <div className="flex-1 p-6">
            {metadata && (
              <ThreePlayer
                videoUrl={metadata.videoUrl}
                backgroundUrl={metadata.backgroundUrl}
              />
            )}
          </div>
          <PlaybackBar />
        </section>
      </div>
    </main>
  );
}
