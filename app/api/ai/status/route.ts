import { NextResponse } from "next/server";

import { isAiConfigured } from "@/lib/ai/hf";
import { resolveProAccess } from "@/lib/pro-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const { betaAllPro: BETA_ALL_PRO_ENABLED, hasProAccess: PRO_ACCESS_ENABLED } =
  resolveProAccess(process.env.NEXT_PUBLIC_PRO_ENABLED === "true");

export async function GET() {
  return NextResponse.json({
    configured: PRO_ACCESS_ENABLED && isAiConfigured(),
    proAccessEnabled: PRO_ACCESS_ENABLED,
    betaAllPro: BETA_ALL_PRO_ENABLED
  });
}
