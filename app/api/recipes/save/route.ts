import { NextRequest, NextResponse } from "next/server";

import { saveRecipeToStore } from "@/lib/saved-recipe-store";
import type { ParsedRecipe } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SaveRecipeBody {
  id?: unknown;
  recipe?: unknown;
}

function parseString(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const value = input.trim();
  return value || undefined;
}

function parseStringArray(input: unknown, max = 300): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, max);
}

function parseRecipe(input: unknown): ParsedRecipe | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const title = parseString(record.title) ?? "Untitled Recipe";
  const ingredients = parseStringArray(record.ingredients, 300);
  const steps = parseStringArray(record.steps, 450);

  if (!ingredients.length || !steps.length) {
    return null;
  }

  return {
    title,
    ingredients,
    steps,
    stepsSimple: parseStringArray(record.stepsSimple, 450),
    stepsDetailed: parseStringArray(record.stepsDetailed, 450),
    rawInstructions: parseStringArray(record.rawInstructions, 500),
    prepTime: parseString(record.prepTime),
    cookTime: parseString(record.cookTime),
    totalTime: parseString(record.totalTime),
    servings: parseString(record.servings),
    image: parseString(record.image),
    source: parseString(record.source),
    sourceUrl: parseString(record.sourceUrl)
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveRecipeBody;
    const recipeId = parseString(body.id);
    const recipe = parseRecipe(body.recipe);

    if (!recipeId || !recipe) {
      return NextResponse.json(
        { error: "Provide recipe id and valid recipe payload." },
        { status: 400 }
      );
    }

    const saved = await saveRecipeToStore(recipeId, recipe);
    return NextResponse.json({ saved: true, recipe: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save recipe.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
