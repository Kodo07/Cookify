"use client";

import { recipeStorageKey } from "@/lib/storage";
import type { ParsedRecipe } from "@/lib/types";

export const SAVED_RECIPE_IDS_KEY = "recipecards:saved-recipe-ids";
export const MEAL_PLANNER_KEY = "recipecards:meal-planner-v1";

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const id of ids) {
    const value = id.trim();
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return output;
}

export function getSavedRecipeIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(SAVED_RECIPE_IDS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return uniqueIds(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return [];
  }
}

export function isRecipeSavedLocally(recipeId: string): boolean {
  return getSavedRecipeIds().includes(recipeId);
}

export function markRecipeSavedLocally(recipeId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const ids = uniqueIds([recipeId, ...getSavedRecipeIds()]);
  localStorage.setItem(SAVED_RECIPE_IDS_KEY, JSON.stringify(ids));
}

export function getSavedRecipesFromLocalStorage(): Array<{
  id: string;
  recipe: ParsedRecipe;
}> {
  if (typeof window === "undefined") {
    return [];
  }

  const output: Array<{ id: string; recipe: ParsedRecipe }> = [];
  for (const id of getSavedRecipeIds()) {
    const raw = localStorage.getItem(recipeStorageKey(id));
    if (!raw) {
      continue;
    }

    try {
      const recipe = JSON.parse(raw) as ParsedRecipe;
      if (!recipe?.title || !Array.isArray(recipe.ingredients)) {
        continue;
      }

      output.push({ id, recipe });
    } catch {
      continue;
    }
  }

  return output;
}
