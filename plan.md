# 🎬 Video Player Assignment — Implementation Plan
> **Stack:** Next.js 14 + TypeScript + Tailwind CSS + Three.js + Zustand  
> **Timeline:** 1 day  
> **Goal:** Max score on all required + bonus criteria

---

## 📁 Folder Structure

```
/
├── app/
│   ├── page.tsx                        # Root page — layout shell
│   ├── layout.tsx                      # Root layout
│   └── api/
│       ├── transcript/route.ts         # Mock API: word-level transcript
│       └── metadata/route.ts           # Mock API: video URL, background URL, duration
│
├── components/
│   ├── player/
│   │   ├── ThreePlayer.tsx             # ⭐ Self-contained Three.js canvas component
│   │   └── useVideoTexture.ts          # Hook: VideoTexture + canvas sync
│   ├── sidebar/
│   │   ├── Transcript.tsx              # Word-level transcript with highlight + skip
│   │   ├── WordChunk.tsx               # Individual word span
│   │   └── VideoControls.tsx           # Padding + rounding sliders
│   └── controls/
│       └── PlaybackBar.tsx             # Play/pause + seekable timeline
│
├── store/
│   ├── usePlaybackStore.ts             # Zustand: isPlaying, currentTime, duration
│   ├── useTranscriptStore.ts           # Zustand: words, activeWordIndex, skippedRanges
│   └── usePlayerConfigStore.ts         # Zustand: padding, borderRadius
│
├── hooks/
│   └── useAnimationFrame.ts            # rAF loop — reads video.currentTime into store
│
├── lib/
│   ├── types.ts                        # Word, Transcript, PlayerConfig interfaces
│   └── transcriptUtils.ts             # findActiveWord(), buildSkipRanges()
│
└── public/
    └── assets/
        ├── background.jpg              # Background image asset
        └── sample.mp4                  # Video asset (or use your provided video)
```

---

## 🗃️ Phase 0 — Types & Interfaces

**File:** `lib/types.ts`

```typescript
export interface Word {
  text: string;
  start: number;   // seconds
  end: number;     // seconds
  type: string;    // "word" | "punctuation" | "spacing"
}

export interface Transcript {
  text: string;
  words: Word[];
}

export interface PlayerConfig {
  padding: number;       // 0–64
  borderRadius: number;  // 0–48
}

export interface SkippedRange {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
}
```

---

## 🗃️ Phase 1 — Zustand Stores

### ① Playback Store
**File:** `store/usePlaybackStore.ts`

```typescript
import { create } from 'zustand';

interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;       // updated by rAF, triggers transcript re-render throttled
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement> | null;

  setVideoRef: (ref: React.RefObject<HTMLVideoElement>) => void;
  setIsPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  videoRef: null,

  setVideoRef: (ref) => set({ videoRef: ref }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),

  play: () => {
    get().videoRef?.current?.play();
    set({ isPlaying: true });
  },
  pause: () => {
    get().videoRef?.current?.pause();
    set({ isPlaying: false });
  },
  seekTo: (time) => {
    const video = get().videoRef?.current;
    if (video) video.currentTime = time;
    set({ currentTime: time });
  },
}));
```

> ⚠️ **Re-render strategy:** `currentTime` in the store is updated by rAF but the transcript only subscribes via a selector that returns `activeWordIndex` — so transcript re-renders only when the active word changes, not every frame.

---

### ② Transcript Store
**File:** `store/useTranscriptStore.ts`

```typescript
import { create } from 'zustand';
import { Transcript, SkippedRange } from '@/lib/types';

interface TranscriptState {
  transcript: Transcript | null;
  activeWordIndex: number;
  skippedRanges: SkippedRange[];

  setTranscript: (t: Transcript) => void;
  setActiveWordIndex: (i: number) => void;
  addSkippedRange: (range: SkippedRange) => void;
  removeSkippedRange: (startIndex: number) => void;
  isWordSkipped: (index: number) => boolean;
  getSkipTarget: (currentTime: number) => number | null; // returns time to seek to if inside skip
}

export const useTranscriptStore = create<TranscriptState>((set, get) => ({
  transcript: null,
  activeWordIndex: -1,
  skippedRanges: [],

  setTranscript: (t) => set({ transcript: t }),
  setActiveWordIndex: (i) => set({ activeWordIndex: i }),

  addSkippedRange: (range) =>
    set((s) => ({ skippedRanges: [...s.skippedRanges, range] })),

  removeSkippedRange: (startIndex) =>
    set((s) => ({
      skippedRanges: s.skippedRanges.filter((r) => r.startIndex !== startIndex),
    })),

  isWordSkipped: (index) =>
    get().skippedRanges.some(
      (r) => index >= r.startIndex && index <= r.endIndex
    ),

  getSkipTarget: (currentTime) => {
    const hit = get().skippedRanges.find(
      (r) => currentTime >= r.startTime && currentTime < r.endTime
    );
    return hit ? hit.endTime : null;
  },
}));
```

---

### ③ Player Config Store
**File:** `store/usePlayerConfigStore.ts`

```typescript
import { create } from 'zustand';

interface PlayerConfigState {
  padding: number;
  borderRadius: number;
  setPadding: (v: number) => void;
  setBorderRadius: (v: number) => void;
}

export const usePlayerConfigStore = create<PlayerConfigState>((set) => ({
  padding: 16,
  borderRadius: 16,
  setPadding: (v) => set({ padding: v }),
  setBorderRadius: (v) => set({ borderRadius: v }),
}));
```

---

## 🗃️ Phase 2 — Mock API Routes

### `app/api/transcript/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const transcript = {
    text: "Hey, back again with Sam here and thanks for attending this meeting. My name is Sam Lee...",
    words: [
      { text: "Hey,",      start: 0.0,  end: 0.3,  type: "word" },
      { text: "back",      start: 0.4,  end: 0.7,  type: "word" },
      { text: "again",     start: 0.8,  end: 1.1,  type: "word" },
      { text: "with",      start: 1.2,  end: 1.4,  type: "word" },
      { text: "Sam",       start: 1.5,  end: 1.8,  type: "word" },
      { text: "here",      start: 1.9,  end: 2.2,  type: "word" },
      { text: "and",       start: 2.3,  end: 2.5,  type: "word" },
      { text: "thanks",    start: 2.6,  end: 3.0,  type: "word" },
      { text: "for",       start: 3.1,  end: 3.3,  type: "word" },
      { text: "attending", start: 3.4,  end: 4.0,  type: "word" },
      { text: "this",      start: 4.1,  end: 4.3,  type: "word" },
      { text: "meeting.",  start: 4.4,  end: 5.0,  type: "word" },
      // ... add all your real words here from the provided JSON
    ]
  };
  return NextResponse.json(transcript);
}
```

### `app/api/metadata/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    videoUrl: '/assets/sample.mp4',
    backgroundUrl: '/assets/background.jpg',
    duration: 165, // seconds
  });
}
```

---

## 🗃️ Phase 3 — Animation Frame Hook

**File:** `hooks/useAnimationFrame.ts`

```typescript
import { useEffect, useRef } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useTranscriptStore } from '@/store/useTranscriptStore';
import { findActiveWordIndex } from '@/lib/transcriptUtils';

// This runs outside React render cycle
// Updates currentTime in store (for PlaybackBar)
// Updates activeWordIndex ONLY when it changes (for Transcript)
export function useAnimationFrame() {
  const rafRef = useRef<number>(0);
  const lastActiveIndex = useRef<number>(-1);

  useEffect(() => {
    const loop = () => {
      const { videoRef, isPlaying, setCurrentTime } = usePlaybackStore.getState();
      const { transcript, setActiveWordIndex, getSkipTarget, seekTo } =
        useTranscriptStore.getState() as any;
      const video = videoRef?.current;

      if (video) {
        const t = video.currentTime;

        // Update currentTime for PlaybackBar
        setCurrentTime(t);

        // Handle skip ranges
        const skipTo = getSkipTarget(t);
        if (skipTo !== null) {
          usePlaybackStore.getState().seekTo(skipTo);
        }

        // Only update activeWordIndex when it actually changes
        if (transcript) {
          const newIndex = findActiveWordIndex(transcript.words, t);
          if (newIndex !== lastActiveIndex.current) {
            lastActiveIndex.current = newIndex;
            setActiveWordIndex(newIndex);
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
}
```

**File:** `lib/transcriptUtils.ts`

```typescript
import { Word } from './types';

export function findActiveWordIndex(words: Word[], currentTime: number): number {
  // Binary search for performance on long transcripts
  let lo = 0, hi = words.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].end < currentTime) lo = mid + 1;
    else if (words[mid].start > currentTime) hi = mid - 1;
    else return mid;
  }
  return -1;
}
```

---

## 🗃️ Phase 4 — Three.js Player Component

**File:** `components/player/ThreePlayer.tsx`

```typescript
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { usePlayerConfigStore } from '@/store/usePlayerConfigStore';

interface Props {
  videoUrl: string;
  backgroundUrl: string;
}

export default function ThreePlayer({ videoUrl, backgroundUrl }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const videoMeshRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number>(0);

  const setVideoRef = usePlaybackStore((s) => s.setVideoRef);
  const setDuration = usePlaybackStore((s) => s.setDuration);

  useEffect(() => {
    const mount = mountRef.current!;
    const W = mount.clientWidth;
    const H = mount.clientHeight;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-W/2, W/2, H/2, -H/2, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Background Plane ---
    const bgTex = new THREE.TextureLoader().load(backgroundUrl);
    const bgGeo = new THREE.PlaneGeometry(W, H);
    const bgMat = new THREE.MeshBasicMaterial({ map: bgTex });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    scene.add(bgMesh);

    // --- Video Element ---
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.loop = false;
    video.muted = false;
    video.playsInline = true;
    video.preload = 'metadata';
    videoElRef.current = video;

    // Wire into Zustand
    const videoRefObj = { current: video };
    setVideoRef(videoRefObj as any);
    video.onloadedmetadata = () => setDuration(video.duration);

    // --- Video Texture + Mesh ---
    const videoTex = new THREE.VideoTexture(video);
    videoTex.minFilter = THREE.LinearFilter;

    // Rounded-corner shader material
    const videoMat = new THREE.ShaderMaterial({
      uniforms: {
        map:          { value: videoTex },
        radius:       { value: 0.1 },     // updated from store
        aspectRatio:  { value: 16/9 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float radius;
        uniform float aspectRatio;
        varying vec2 vUv;

        float roundedBox(vec2 uv, float r) {
          vec2 q = abs(uv - 0.5) - (0.5 - r);
          return length(max(q, 0.0)) - r;
        }

        void main() {
          float d = roundedBox(vUv, radius);
          if (d > 0.0) discard;
          gl_FragColor = texture2D(map, vUv);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
    });

    const videoW = W * 0.6;
    const videoH = videoW * (9/16);
    const videoGeo = new THREE.PlaneGeometry(videoW, videoH);
    const videoMesh = new THREE.Mesh(videoGeo, videoMat);
    videoMesh.position.z = 1;
    scene.add(videoMesh);
    videoMeshRef.current = videoMesh;

    // --- Render Loop ---
    const animate = () => {
      videoTex.needsUpdate = true;

      // Read config from store without subscription (no re-render)
      const { padding, borderRadius } = usePlayerConfigStore.getState();
      const scale = 1 - (padding / 200);
      videoMesh.scale.set(scale, scale, 1);
      (videoMat.uniforms.radius as any).value = borderRadius / 500;

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    // --- Resize ---
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.left = -w/2; camera.right = w/2;
      camera.top = h/2; camera.bottom = -h/2;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [videoUrl, backgroundUrl]);

  return <div ref={mountRef} className="w-full h-full" />;
}
```

---

## 🗃️ Phase 5 — Transcript Sidebar

**File:** `components/sidebar/Transcript.tsx`

```typescript
'use client';
import { useRef, useEffect } from 'react';
import { useTranscriptStore } from '@/store/useTranscriptStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';

export default function Transcript() {
  const transcript = useTranscriptStore((s) => s.transcript);
  const activeWordIndex = useTranscriptStore((s) => s.activeWordIndex);
  const skippedRanges = useTranscriptStore((s) => s.skippedRanges);
  const addSkippedRange = useTranscriptStore((s) => s.addSkippedRange);
  const removeSkippedRange = useTranscriptStore((s) => s.removeSkippedRange);
  const isWordSkipped = useTranscriptStore((s) => s.isWordSkipped);
  const seekTo = usePlaybackStore((s) => s.seekTo);

  const activeWordRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active word into view
  useEffect(() => {
    activeWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeWordIndex]);

  // Skip selection logic
  const handleSkipSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !transcript) return;

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer.parentElement;
    const endNode = range.endContainer.parentElement;

    const startIdx = parseInt(startNode?.dataset.wordIndex ?? '-1');
    const endIdx = parseInt(endNode?.dataset.wordIndex ?? '-1');

    if (startIdx < 0 || endIdx < 0 || startIdx > endIdx) return;

    addSkippedRange({
      startIndex: startIdx,
      endIndex: endIdx,
      startTime: transcript.words[startIdx].start,
      endTime: transcript.words[endIdx].end,
    });
    selection.removeAllRanges();
  };

  if (!transcript) return <div className="p-4 text-gray-400">Loading transcript...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Script</span>
        <button
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          onMouseUp={handleSkipSelection}
        >
          ↷ Skip Selection
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-3 leading-7 text-sm text-gray-300 select-text"
      >
        {transcript.words.map((word, i) => {
          const isActive = i === activeWordIndex;
          const skipped = isWordSkipped(i);
          const skippedRange = skippedRanges.find(
            (r) => r.startIndex === i
          );

          return (
            <span key={i} className="inline">
              <span
                ref={isActive ? activeWordRef : undefined}
                data-word-index={i}
                onClick={() => seekTo(word.start)}
                className={[
                  'cursor-pointer rounded px-0.5 transition-all duration-100',
                  isActive && !skipped
                    ? 'bg-yellow-300 text-gray-900 font-semibold'
                    : '',
                  skipped
                    ? 'line-through text-gray-600 bg-red-900/20'
                    : 'hover:bg-gray-700',
                ].join(' ')}
                title={skipped ? 'Click to unskip' : `${word.start.toFixed(2)}s`}
                onDoubleClick={() => {
                  if (skipped) {
                    const range = skippedRanges.find(
                      (r) => i >= r.startIndex && i <= r.endIndex
                    );
                    if (range) removeSkippedRange(range.startIndex);
                  }
                }}
              >
                {word.text}
              </span>
              {' '}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 🗃️ Phase 6 — Video Controls

**File:** `components/sidebar/VideoControls.tsx`

```typescript
'use client';
import { usePlayerConfigStore } from '@/store/usePlayerConfigStore';

export default function VideoControls() {
  const padding = usePlayerConfigStore((s) => s.padding);
  const borderRadius = usePlayerConfigStore((s) => s.borderRadius);
  const setPadding = usePlayerConfigStore((s) => s.setPadding);
  const setBorderRadius = usePlayerConfigStore((s) => s.setBorderRadius);

  return (
    <div className="border-t border-gray-800 px-4 py-4 space-y-4">
      <SliderRow
        label="Padding"
        value={padding}
        min={0} max={64}
        onChange={setPadding}
      />
      <SliderRow
        label="Rounding"
        value={borderRadius}
        min={0} max={48}
        onChange={setBorderRadius}
      />
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="text-gray-200 font-mono">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 font-mono w-5">{min}</span>
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-blue-500 h-1 rounded"
        />
        <span className="text-xs text-gray-600 font-mono w-5">{max}</span>
      </div>
    </div>
  );
}
```

---

## 🗃️ Phase 7 — Playback Bar

**File:** `components/controls/PlaybackBar.tsx`

```typescript
'use client';
import { usePlaybackStore } from '@/store/usePlaybackStore';

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export default function PlaybackBar() {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const duration = usePlaybackStore((s) => s.duration);
  const play = usePlaybackStore((s) => s.play);
  const pause = usePlaybackStore((s) => s.pause);
  const seekTo = usePlaybackStore((s) => s.seekTo);

  return (
    <div className="bg-gray-950 border-t border-gray-800 px-6 py-4">
      {/* Timeline */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-gray-500 font-mono w-10 text-right">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="flex-1 accent-blue-500 h-1 rounded"
        />
        <span className="text-xs text-gray-500 font-mono w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={isPlaying ? pause : play}
          className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500
                     flex items-center justify-center transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <span className="text-white text-xs">⏸</span>
            : <span className="text-white text-xs pl-0.5">▶</span>
          }
        </button>
      </div>
    </div>
  );
}
```

---

## 🗃️ Phase 8 — Root Page

**File:** `app/page.tsx`

```typescript
'use client';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useTranscriptStore } from '@/store/useTranscriptStore';
import { useAnimationFrame } from '@/hooks/useAnimationFrame';
import Transcript from '@/components/sidebar/Transcript';
import VideoControls from '@/components/sidebar/VideoControls';
import PlaybackBar from '@/components/controls/PlaybackBar';

// Dynamic import prevents SSR for Three.js
const ThreePlayer = dynamic(() => import('@/components/player/ThreePlayer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <span className="text-gray-500 text-sm">Loading player...</span>
    </div>
  ),
});

export default function Home() {
  const setTranscript = useTranscriptStore((s) => s.setTranscript);
  const [metadata, setMetadata] = useState<any>(null);

  // Start rAF loop
  useAnimationFrame();

  // Fetch from mock APIs
  useEffect(() => {
    Promise.all([
      fetch('/api/transcript').then((r) => r.json()),
      fetch('/api/metadata').then((r) => r.json()),
    ]).then(([transcript, meta]) => {
      setTranscript(transcript);
      setMetadata(meta);
    });
  }, []);

  // Keyboard shortcut: space = play/pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        const { isPlaying, play, pause } = usePlaybackStore.getState();
        isPlaying ? pause() : play();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <main className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[320px] shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden">
          <Transcript />
          <VideoControls />
        </aside>

        {/* Right Panel */}
        <section className="flex-1 flex flex-col overflow-hidden bg-gray-950">
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
```

---

## 🗃️ Phase 9 — Setup Commands

Run these in order in your terminal:

```bash
# 1. Create project
npx create-next-app@latest video-player --typescript --tailwind --app --src-dir=false
cd video-player

# 2. Install dependencies
npm install three zustand
npm install -D @types/three

# 3. Add your assets
mkdir -p public/assets
# Copy your video.mp4 → public/assets/sample.mp4
# Copy your background.jpg → public/assets/background.jpg

# 4. Paste your transcript words into app/api/transcript/route.ts

# 5. Run dev
npm run dev
```

---

## ✅ Scoring Checklist

| Criterion | Implementation | File |
|---|---|---|
| Three.js canvas compositing | ShaderMaterial + VideoTexture on OrthographicCamera | `ThreePlayer.tsx` |
| Self-contained player component | Single file, props-only interface | `ThreePlayer.tsx` |
| Background + video composite | Two PlaneGeometry meshes | `ThreePlayer.tsx` |
| Word-level transcript sync | rAF loop + binary search | `useAnimationFrame.ts` |
| Active word highlight | `activeWordIndex` from Zustand | `Transcript.tsx` |
| Skip / unskip with strikethrough | Selection API + `skippedRanges` store | `Transcript.tsx` |
| Skip auto-seeks during playback | `getSkipTarget()` in rAF loop | `useAnimationFrame.ts` |
| Padding slider (real-time) | `usePlayerConfigStore` → Three.js scale | `VideoControls.tsx` |
| Rounding slider (real-time) | GLSL `radius` uniform update | `ThreePlayer.tsx` |
| Play / Pause button | Zustand action → `video.play()` | `PlaybackBar.tsx` |
| Seekable timeline | `<input type="range">` → `seekTo()` | `PlaybackBar.tsx` |
| No unnecessary re-renders | rAF reads store without subscriptions; transcript re-renders only on word change | `useAnimationFrame.ts` |
| **BONUS:** Click word to seek | `onClick={() => seekTo(word.start)}` | `Transcript.tsx` |
| **BONUS:** Mock API | `/api/transcript` + `/api/metadata` | `app/api/` |
| **BONUS:** Binary search perf | `findActiveWordIndex` with binary search | `transcriptUtils.ts` |
| **BONUS:** Keyboard shortcut | Spacebar play/pause | `page.tsx` |
| **BONUS:** Auto-scroll transcript | `scrollIntoView` on active word | `Transcript.tsx` |

---

## 💬 Interview Prep: MP4 Export Approach

When asked about exporting the composed canvas as MP4, discuss this approach:

**Architecture:**
1. Use the **MediaRecorder API** to record the Three.js `renderer.domElement` (the canvas) as a `MediaStream` via `canvas.captureStream(30)` at 30fps
2. Pipe the stream into `MediaRecorder` with `video/webm` codec first (broad browser support), then convert to MP4 server-side
3. Sync audio separately by recording the `HTMLVideoElement`'s audio track via `AudioContext` + `MediaStreamDestination`, then merge both streams

**Tooling:**
- **Client-side:** `MediaRecorder` + `canvas.captureStream()` → produces WebM
- **Server-side conversion:** `ffmpeg` (via a Next.js API route using `fluent-ffmpeg` or edge function calling a Lambda) to remux WebM → MP4
- **Alternative:** `mp4-muxer` (npm) for pure client-side MP4 writing — avoids server round-trip

**Performance considerations:**
- Cap canvas resolution to 1080p during export even if display is higher
- Use `requestAnimationFrame` in export mode locked to 30fps via `setTimeout` throttle
- For long videos, chunk the recording into segments and concatenate server-side
- Skip ranges must be honored during export by pausing the MediaRecorder and advancing `video.currentTime`

---

*Generated for 1-day implementation. Use Claude Code in VSCode to implement each phase sequentially, copy-pasting the code blocks above as starting points.*