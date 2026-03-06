import { NextResponse } from "next/server";

import { getSavedRecipes } from "@/lib/saved-recipe-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recipes = await getSavedRecipes();
    return NextResponse.json({ recipes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load recipe library.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
