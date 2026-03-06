import { NextResponse } from "next/server";

import { isAiConfigured } from "@/lib/ai/hf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: isAiConfigured()
  });
}
