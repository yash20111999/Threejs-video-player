import { NextResponse } from "next/server";
import transcript from "@/data/transcript.clean.json";
import type { Transcript } from "@/lib/types";

// Mock API: serves the word-level transcript. In a real system this would hit
// a transcription service / DB; here it streams the bundled JSON.
export async function GET() {
  return NextResponse.json(transcript as Transcript);
}
