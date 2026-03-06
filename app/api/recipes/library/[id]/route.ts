import { NextRequest, NextResponse } from "next/server";

import { getSavedRecipes } from "@/lib/saved-recipe-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const recipeId = params.id?.trim();
    if (!recipeId) {
      return NextResponse.json({ error: "Recipe id is required." }, { status: 400 });
    }

    const recipes = await getSavedRecipes();
    const recipe = recipes.find((entry) => entry.id === recipeId);

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load recipe from library.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
