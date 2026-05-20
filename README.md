# Composited Video Player

A custom video player where a background image and a video are composited together on a **Three.js** canvas, with a synced word-level transcript sidebar.

Built with Next.js 14 (App Router) + TypeScript + Tailwind CSS + Zustand.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm start   # production
```

## Features

| Area | Implementation |
|---|---|
| Canvas compositing | Three.js orthographic scene: background plane (cover-fit) + video plane on top |
| Self-contained player | `components/player/ThreePlayer.tsx` — props-only, drop-in reusable |
| Rounded corners | Pixel-space rounded-rect SDF fragment shader (anti-aliased, aspect-correct) |
| Transcript sync | Binary-search active-word lookup driven by an rAF loop |
| Skip / unskip | Select text → Skip; struck-through, auto-seeks past during playback, click to unskip |
| Padding / rounding | Sliders → `usePlayerConfigStore`, applied in the render loop in real time |
| Playback | Play/pause, seekable timeline, spacebar shortcut, click-word-to-seek |
| Mock API | `/api/transcript` and `/api/metadata` |
| Performance | rAF runs outside React; timeline writes throttled (~10/s); per-word memoized subscriptions so a word change re-renders 2 spans, not the whole list; Three.js loaded `ssr:false` |

## Project structure

```
app/
  page.tsx                 # layout shell, data fetch, keyboard shortcut
  layout.tsx
  api/transcript/route.ts  # mock API (serves cleaned word-level JSON)
  api/metadata/route.ts    # mock API (video/background URL, duration)
components/
  player/ThreePlayer.tsx   # self-contained Three.js canvas
  sidebar/Transcript.tsx   # transcript + selection-to-skip
  sidebar/WordChunk.tsx    # memoized per-word span (isolated subscriptions)
  sidebar/VideoControls.tsx
  controls/PlaybackBar.tsx
hooks/useAnimationFrame.ts # single rAF: currentTime + active word + skip seek
lib/
  types.ts
  transcriptUtils.ts       # binary search
store/                     # 3 Zustand stores: playback, transcript, config
data/transcript.clean.json # source transcript (original had a trailing comma)
public/assets/             # video.mp4, background.jpg
```

## Deployment (Vercel)

Zero-config — it's a standard Next.js app.

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
```

Or import the repo at [vercel.com/new](https://vercel.com/new); build command `next build`, output handled automatically. `vercel.json` pins the framework and a longer max duration for the asset/API routes.

## MP4 export approach (discussion only — not implemented)

Capture `renderer.domElement` via `canvas.captureStream(30)`, feed it to `MediaRecorder` (WebM/VP9) while mixing the video element's audio track through an `AudioContext` + `MediaStreamAudioDestinationNode`. Convert WebM → MP4 either client-side with `mp4-muxer`/`ffmpeg.wasm` or server-side via an `ffmpeg` job for larger files. For long videos: cap export to 1080p, drive the loop at a fixed 30fps timestep, honor skipped ranges by advancing `video.currentTime` past them, and chunk + concatenate to bound memory.
