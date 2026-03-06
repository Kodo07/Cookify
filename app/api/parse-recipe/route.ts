import { NextRequest, NextResponse } from "next/server";

import { parseRecipeFromUrl } from "@/lib/recipe-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      url?: string;
    };

    if (!body.url?.trim()) {
      return NextResponse.json(
        { error: "Please paste a recipe URL to continue." },
        { status: 400 }
      );
    }

    const recipe = await parseRecipeFromUrl(body.url);
    return NextResponse.json({ recipe });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Recipe parsing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
