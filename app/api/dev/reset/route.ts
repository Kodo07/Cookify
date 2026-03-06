import { NextRequest, NextResponse } from "next/server";

import { resetSavedRecipeStore } from "@/lib/saved-recipe-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isResetAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const allowHeader = request.headers.get("x-reset-token");
  return Boolean(allowHeader && allowHeader === process.env.DEV_RESET_TOKEN);
}

export async function POST(request: NextRequest) {
  if (!isResetAllowed(request)) {
    return NextResponse.json({ error: "Reset is disabled in production." }, { status: 403 });
  }

  try {
    await resetSavedRecipeStore();
    return NextResponse.json({
      ok: true,
      cleared: {
        savedRecipeStore: true
      }
    });
  } catch (error) {
    console.error("[dev-reset] failed", error);
    return NextResponse.json(
      { error: "Could not clear server demo data." },
      { status: 500 }
    );
  }
}
