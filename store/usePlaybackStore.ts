import { create } from "zustand";

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  videoEl: HTMLVideoElement | null;

  setVideoEl: (el: HTMLVideoElement | null) => void;
  setIsPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekTo: (time: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  videoEl: null,

  setVideoEl: (el) => set({ videoEl: el }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),

  play: () => {
    void get().videoEl?.play();
    set({ isPlaying: true });
  },
  pause: () => {
    get().videoEl?.pause();
    set({ isPlaying: false });
  },
  togglePlay: () => {
    const { isPlaying, play, pause } = get();
    if (isPlaying) pause();
    else play();
  },
  seekTo: (time) => {
    const video = get().videoEl;
    const clamped = Math.max(0, Math.min(time, get().duration || time));
    if (video) video.currentTime = clamped;
    set({ currentTime: clamped });
  },
}));
