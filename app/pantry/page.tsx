"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SiteNav } from "@/components/site-nav";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useAiStatus } from "@/hooks/use-ai-status";
import { parseIngredientInput } from "@/lib/ingredient-normalize";
import { markRecipeSavedLocally } from "@/lib/local-library";
import { createRecipeId, recipeStorageKey } from "@/lib/storage";
import type { ParsedRecipe } from "@/lib/types";

type DietOption = "none" | "vegetarian" | "vegan" | "gluten-free" | "dairy-free";

interface GeneratedRecipeResponse {
  title?: string;
  ingredients?: string[];
  steps?: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  error?: string;
}

const PRO_ENABLED = process.env.NEXT_PUBLIC_PRO_ENABLED === "true";

function parseApiRecipe(payload: GeneratedRecipeResponse): ParsedRecipe | null {
  if (
    typeof payload.title !== "string" ||
    !Array.isArray(payload.ingredients) ||
    !Array.isArray(payload.steps)
  ) {
    return null;
  }

  const ingredients = payload.ingredients
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  const steps = payload.steps
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!ingredients.length || !steps.length) {
    return null;
  }

  return {
    title: payload.title.trim() || "Pantry Recipe",
    ingredients,
    steps,
    stepsSimple: steps,
    stepsDetailed: steps,
    prepTime: typeof payload.prepTime === "string" ? payload.prepTime : undefined,
    cookTime: typeof payload.cookTime === "string" ? payload.cookTime : undefined,
    servings: typeof payload.servings === "string" ? payload.servings : undefined,
    source: "AI Pantry Generator"
  };
}

export default function PantryPage() {
  const router = useRouter();
  const { configured: aiConfigured, loading: aiStatusLoading } =
    useAiStatus(PRO_ENABLED);

  const [ingredientsInput, setIngredientsInput] = useState("");
  const [servings, setServings] = useState(2);
  const [diet, setDiet] = useState<DietOption>("none");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const parsedIngredients = useMemo(
    () => parseIngredientInput(ingredientsInput),
    [ingredientsInput]
  );

  async function handleGenerateRecipe() {
    setGenerationError(null);

    if (!parsedIngredients.length) {
      setGenerationError("Add ingredients before generating a recipe.");
      return;
    }

    if (!PRO_ENABLED) {
      setShowUpgradeModal(true);
      return;
    }

    if (aiStatusLoading) {
      setGenerationError("Checking AI configuration...");
      return;
    }

    if (!aiConfigured) {
      setGenerationError("AI not configured. Add HF_TOKEN on the server.");
      return;
    }

    setGeneratingRecipe(true);

    try {
      const response = await fetch("/api/ai/generateRecipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ingredients: parsedIngredients,
          servings,
          diet
        }),
        cache: "no-store"
      });

      const payload = (await response.json()) as GeneratedRecipeResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "AI recipe generation failed.");
      }

      const parsedRecipe = parseApiRecipe(payload);
      if (!parsedRecipe) {
        throw new Error("AI response format was invalid.");
      }

      const recipeId = createRecipeId(parsedRecipe.title);
      localStorage.setItem(recipeStorageKey(recipeId), JSON.stringify(parsedRecipe));
      markRecipeSavedLocally(recipeId);

      void fetch("/api/recipes/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: recipeId,
          recipe: parsedRecipe
        })
      }).catch(() => undefined);

      router.push(`/recipe/${recipeId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const friendlyMessage = message.toLowerCase().includes("rate limit")
        ? "Too many requests right now. Please wait a moment and try again."
        : "We couldn't generate a recipe right now. Please try again in a moment.";
      setGenerationError(friendlyMessage);
    } finally {
      setGeneratingRecipe(false);
    }
  }

  return (
    <main className="soft-grid min-h-screen bg-canvas bg-hero-radial px-4 py-8 sm:px-6">
      <UpgradeModal
        open={showUpgradeModal}
        feature="AI Pantry Recipe Generator"
        onClose={() => setShowUpgradeModal(false)}
      />

      <div className="mx-auto max-w-6xl space-y-6">
        <SiteNav />

        <section className="card mx-auto w-full max-w-3xl border-white/90 p-6 sm:p-8">
          <div className="mb-4">
            <h1 className="text-3xl text-ink sm:text-4xl">Pantry Generator</h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Enter ingredients you have and RecipeCards will generate a recipe for
              you.
            </p>
          </div>

          <label htmlFor="pantry-ingredients" className="mb-2 block text-sm text-slate-600">
            Ingredients (one per line or comma-separated)
          </label>
          <textarea
            id="pantry-ingredients"
            value={ingredientsInput}
            onChange={(event) => setIngredientsInput(event.target.value)}
            rows={7}
            placeholder="eggs, spinach, garlic, olive oil"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            aria-label="Pantry ingredients"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-600">
              Servings
              <input
                type="number"
                min={1}
                max={24}
                value={servings}
                onChange={(event) =>
                  setServings(Math.min(24, Math.max(1, Number(event.target.value) || 2)))
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                aria-label="Target servings"
              />
            </label>

            <label className="text-sm text-slate-600">
              Dietary preference
              <select
                value={diet}
                onChange={(event) => setDiet(event.target.value as DietOption)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                aria-label="Dietary preference"
              >
                <option value="none">None</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="gluten-free">Gluten-Free</option>
                <option value="dairy-free">Dairy-Free</option>
              </select>
            </label>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleGenerateRecipe}
              disabled={generatingRecipe}
              className="w-full rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Generate recipe with AI"
            >
              {generatingRecipe ? "Generating..." : "\u2728 Generate recipe"}
              {!PRO_ENABLED ? (
                <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white">
                  Pro
                </span>
              ) : null}
            </button>
          </div>

          {PRO_ENABLED && aiConfigured === false ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              AI not configured on server. Add HF_TOKEN to enable generation.
            </p>
          ) : null}

          {generatingRecipe ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Building Recipe
              </p>
              <h2 className="mt-1 text-lg text-ink">Creating your pantry recipe...</h2>
              <p className="mt-1 text-sm text-slate-600">
                We are balancing your ingredients, servings, and dietary preference.
              </p>
            </div>
          ) : generationError ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {generationError}
            </p>
          ) : !parsedIngredients.length ? (
            <div className="card border-dashed border-slate-200 p-6 text-center">
              <h3 className="text-xl text-ink">Ready when you are</h3>
              <p className="mt-2 text-sm text-slate-600">
                Add ingredients to generate a custom recipe in one step.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Example: eggs, spinach, garlic, olive oil
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Ready to Generate
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {parsedIngredients.length} ingredients detected. Tap
                {" \u2728 Generate recipe"} to create your recipe.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
