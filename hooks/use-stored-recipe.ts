"use client";

import { useEffect, useState } from "react";

import { recipeStorageKey } from "@/lib/storage";
import type { ParsedRecipe } from "@/lib/types";

export function useStoredRecipe(recipeId: string) {
  const [recipe, setRecipe] = useState<ParsedRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRecipe() {
      setLoading(true);
      setError(null);
      setRecipe(null);

      if (!recipeId) {
        if (!active) {
          return;
        }
        setError("Invalid recipe link.");
        setLoading(false);
        return;
      }

      try {
        const localRaw = localStorage.getItem(recipeStorageKey(recipeId));
        if (localRaw) {
          const parsed = JSON.parse(localRaw) as ParsedRecipe;
          if (!active) {
            return;
          }
          setRecipe(parsed);
          setLoading(false);
          return;
        }

        const response = await fetch(
          `/api/recipes/library/${encodeURIComponent(recipeId)}`,
          {
          method: "GET",
          cache: "no-store"
          }
        );

        const payload = (await response.json()) as {
          recipe?: ParsedRecipe;
          error?: string;
        };

        if (!response.ok || !payload.recipe) {
          throw new Error(
            payload.error ??
              "Recipe data is unavailable. Convert the recipe again from the homepage."
          );
        }

        localStorage.setItem(recipeStorageKey(recipeId), JSON.stringify(payload.recipe));

        if (!active) {
          return;
        }

        setRecipe(payload.recipe);
      } catch (storageError) {
        if (!active) {
          return;
        }
        setError(
          storageError instanceof Error
            ? storageError.message
            : "Failed to load the recipe data."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRecipe();

    return () => {
      active = false;
    };
  }, [recipeId]);

  return {
    recipe,
    loading,
    error
  };
}
