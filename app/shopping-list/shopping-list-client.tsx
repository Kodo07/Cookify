"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SiteNav } from "@/components/site-nav";
import { UpgradeModal } from "@/components/upgrade-modal";
import { getSavedRecipesFromLocalStorage } from "@/lib/local-library";
import { resolveProAccess } from "@/lib/pro-access";
import {
  GROCERY_CATEGORIES,
  GROCERY_CATEGORY_LABELS,
  GROCERY_EMPTY_MESSAGES,
  buildCategorizedShoppingList,
  flattenCategorizedShoppingList,
  type CategorizedShoppingList,
  type GroceryCategory
} from "@/lib/shopping-list";

const { betaAllPro: BETA_ALL_PRO_ENABLED, hasProAccess: PRO_ENABLED } = resolveProAccess(
  process.env.NEXT_PUBLIC_PRO_ENABLED === "true"
);

interface LocalRecipeSummary {
  id: string;
  title: string;
  ingredients: string[];
}

function createEmptyList(): CategorizedShoppingList {
  return {
    Produce: [],
    Dairy: [],
    Pantry: [],
    "Meat&Seafood": [],
    Spices: [],
    Other: []
  };
}

export default function ShoppingListClient() {
  const searchParams = useSearchParams();
  const [initialized, setInitialized] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<LocalRecipeSummary[]>([]);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  const [shoppingList, setShoppingList] = useState<CategorizedShoppingList>(
    createEmptyList()
  );
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const recipes = getSavedRecipesFromLocalStorage().map(({ id, recipe }) => ({
      id,
      title: recipe.title,
      ingredients: recipe.ingredients
    }));

    setSavedRecipes(recipes);

    const queryIds = (searchParams.get("recipes") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (queryIds.length) {
      setSelectedRecipeIds(queryIds);
      setInitialized(true);
      return;
    }

    if (recipes.length === 1) {
      setSelectedRecipeIds([recipes[0].id]);
    }

    setInitialized(true);
  }, [searchParams]);

  const selectedRecipes = useMemo(() => {
    const idSet = new Set(selectedRecipeIds);
    return savedRecipes.filter((recipe) => idSet.has(recipe.id));
  }, [savedRecipes, selectedRecipeIds]);

  const hasGeneratedItems = useMemo(() => {
    return GROCERY_CATEGORIES.some((category) => shoppingList[category].length > 0);
  }, [shoppingList]);

  function toggleRecipe(id: string) {
    setSelectedRecipeIds((previous) =>
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]
    );
  }

  function generateShoppingList() {
    if (!PRO_ENABLED) {
      setShowUpgradeModal(true);
      return;
    }

    const ingredients = selectedRecipes.flatMap((recipe) => recipe.ingredients);
    const generated = buildCategorizedShoppingList(ingredients);
    setShoppingList(generated);
    setCheckedItems({});
    setCopyState("idle");
  }

  function toggleItem(category: GroceryCategory, item: string) {
    const key = `${category}:${item}`;
    setCheckedItems((previous) => ({
      ...previous,
      [key]: !previous[key]
    }));
  }

  async function copyToClipboard() {
    if (!hasGeneratedItems) {
      return;
    }

    try {
      const text = flattenCategorizedShoppingList(shoppingList).join("\n").trim();
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  return (
    <main className="soft-grid min-h-screen bg-canvas bg-hero-radial px-4 py-8 sm:px-6">
      {!BETA_ALL_PRO_ENABLED ? (
        <UpgradeModal
          open={showUpgradeModal}
          feature="Smart Grocery List"
          onClose={() => setShowUpgradeModal(false)}
        />
      ) : null}

      <div className="mx-auto max-w-6xl space-y-6">
        <SiteNav />

        <section className="card border-white/90 p-6 sm:p-8">
          <h1 className="text-3xl text-ink sm:text-4xl">Smart Grocery List</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Select one or more saved recipes and generate one merged shopping list.
          </p>

          {!initialized ? (
            <div className="mt-5 grid gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : null}

          {initialized && !savedRecipes.length ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/90 p-5 text-sm text-slate-600">
              No saved recipes yet. Save a recipe first, then come back to build a list.
              <div className="mt-2">
                <Link href="/" className="font-semibold text-slate-900 underline">
                  Import a recipe now
                </Link>
              </div>
            </div>
          ) : null}

          {initialized && savedRecipes.length ? (
            <div className="mt-5 grid gap-2">
              {savedRecipes.map((recipe) => (
                <label
                  key={recipe.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:border-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipeIds.includes(recipe.id)}
                    onChange={() => toggleRecipe(recipe.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                    aria-label={`Select ${recipe.title}`}
                  />
                  <span className="text-sm text-slate-800">{recipe.title}</span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generateShoppingList}
              disabled={!selectedRecipeIds.length}
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Generate shopping list"
            >
              Generate combined shopping list
              {!PRO_ENABLED ? (
                <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white">
                  Pro
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!hasGeneratedItems}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Copy shopping list to clipboard"
            >
              Copy to clipboard
            </button>
            {copyState === "copied" ? (
              <span className="self-center text-sm text-emerald-700">Copied.</span>
            ) : null}
            {copyState === "error" ? (
              <span className="self-center text-sm text-rose-700">
                Could not copy list.
              </span>
            ) : null}
          </div>

          {initialized && selectedRecipeIds.length > 0 && !hasGeneratedItems ? (
            <p className="mt-4 text-sm text-slate-600">
              Your shopping list will appear here after you click{" "}
              <span className="font-semibold">Generate combined shopping list</span>.
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {GROCERY_CATEGORIES.map((category) => (
            <article key={category} className="card border-white/90 p-5">
              <h2 className="mb-3 text-xl text-ink">{GROCERY_CATEGORY_LABELS[category]}</h2>
              {shoppingList[category].length ? (
                <div className="space-y-2">
                  {shoppingList[category].map((item) => {
                    const key = `${category}:${item}`;
                    const checked = Boolean(checkedItems[key]);

                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer gap-3 rounded-xl px-2 py-1.5 ${
                          checked ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(category, item)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                          aria-label={`Toggle ${item}`}
                        />
                        <span className={checked ? "line-through" : ""}>{item}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{GROCERY_EMPTY_MESSAGES[category]}</p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
