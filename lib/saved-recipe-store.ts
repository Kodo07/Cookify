import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ParsedRecipe } from "@/lib/types";

export interface SavedRecipeRecord extends ParsedRecipe {
  id: string;
  savedAt: number;
}

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIRECTORY, "saved-recipes.json");

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();
  return text || undefined;
}

function cleanStringArray(value: unknown, max = 240): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeRecipeRecord(id: string, recipe: ParsedRecipe): SavedRecipeRecord {
  const savedAt = Date.now();
  return {
    id: cleanString(id) ?? `recipe-${savedAt.toString(36)}`,
    savedAt,
    title: cleanString(recipe.title) ?? "Untitled Recipe",
    ingredients: cleanStringArray(recipe.ingredients, 300),
    steps: cleanStringArray(recipe.steps, 400),
    stepsSimple: cleanStringArray(recipe.stepsSimple, 400),
    stepsDetailed: cleanStringArray(recipe.stepsDetailed, 400),
    rawInstructions: cleanStringArray(recipe.rawInstructions, 500),
    prepTime: cleanString(recipe.prepTime),
    cookTime: cleanString(recipe.cookTime),
    totalTime: cleanString(recipe.totalTime),
    servings: cleanString(recipe.servings),
    image: cleanString(recipe.image),
    source: cleanString(recipe.source),
    sourceUrl: cleanString(recipe.sourceUrl)
  };
}

async function ensureStoreFileExists(): Promise<void> {
  await mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await readFile(STORE_FILE, "utf8");
  } catch {
    await writeFile(STORE_FILE, "[]", "utf8");
  }
}

async function readStore(): Promise<SavedRecipeRecord[]> {
  await ensureStoreFileExists();

  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is Record<string, unknown> => {
        return typeof entry === "object" && entry !== null;
      })
      .map((entry) => {
        const id = cleanString(entry.id) ?? `recipe-${Date.now().toString(36)}`;
        const title = cleanString(entry.title) ?? "Untitled Recipe";
        const ingredients = cleanStringArray(entry.ingredients, 300);
        const steps = cleanStringArray(entry.steps, 400);
        const stepsSimple = cleanStringArray(entry.stepsSimple, 400);
        const stepsDetailed = cleanStringArray(entry.stepsDetailed, 400);
        const rawInstructions = cleanStringArray(entry.rawInstructions, 500);
        const savedAt =
          typeof entry.savedAt === "number" && Number.isFinite(entry.savedAt)
            ? entry.savedAt
            : Date.now();

        return {
          id,
          title,
          ingredients,
          steps,
          stepsSimple,
          stepsDetailed,
          rawInstructions,
          savedAt,
          prepTime: cleanString(entry.prepTime),
          cookTime: cleanString(entry.cookTime),
          totalTime: cleanString(entry.totalTime),
          servings: cleanString(entry.servings),
          image: cleanString(entry.image),
          source: cleanString(entry.source),
          sourceUrl: cleanString(entry.sourceUrl)
        };
      })
      .filter((entry) => entry.ingredients.length > 0);
  } catch {
    return [];
  }
}

async function writeStore(records: SavedRecipeRecord[]): Promise<void> {
  await ensureStoreFileExists();
  await writeFile(STORE_FILE, JSON.stringify(records, null, 2), "utf8");
}

export async function getSavedRecipes(): Promise<SavedRecipeRecord[]> {
  const records = await readStore();
  return records.sort((left, right) => right.savedAt - left.savedAt);
}

export async function saveRecipeToStore(
  recipeId: string,
  recipe: ParsedRecipe
): Promise<SavedRecipeRecord> {
  const normalized = normalizeRecipeRecord(recipeId, recipe);
  const records = await readStore();
  const withoutExisting = records.filter((entry) => entry.id !== normalized.id);
  const nextRecords = [normalized, ...withoutExisting].slice(0, 500);
  await writeStore(nextRecords);
  return normalized;
}

export async function resetSavedRecipeStore(): Promise<void> {
  await writeStore([]);
}
