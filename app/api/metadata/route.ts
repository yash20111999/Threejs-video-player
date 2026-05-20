import { NextResponse } from "next/server";
import type { VideoMetadata } from "@/lib/types";

// Mock API: video URL, background URL, duration.
export async function GET() {
  const metadata: VideoMetadata = {
    videoUrl: "/assets/video.mp4",
    backgroundUrl: "/assets/background.jpg",
    duration: 200.42,
  };
  return NextResponse.json(metadata);
}
