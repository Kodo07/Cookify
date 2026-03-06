"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { SiteNav } from "@/components/site-nav";
import { createRecipeId, recipeStorageKey } from "@/lib/storage";
import type { ErrorResponse, ParsedRecipe } from "@/lib/types";

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

function toRecipeUrl(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

const EXAMPLE_RECIPE_URL =
  "https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/";

const benefitCards = [
  {
    title: "Cleaner Cooking Flow",
    body: "Follow one focused step at a time without scrolling through long blog content."
  },
  {
    title: "Built-In Timers",
    body: "Start and track multiple timers directly from instructions while you cook."
  },
  {
    title: "Prep Mode",
    body: "Review ingredients and prep tasks before heat goes on, so execution is smoother."
  },
  {
    title: "Distraction-Free Cook Mode",
    body: "Large controls and high-contrast UI built for real kitchen use on mobile."
  }
];

export default function HomePage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  async function handleConvert() {
    setRequestError(null);
    setUrlError(null);

    if (!urlInput.trim()) {
      setUrlError("Paste a recipe link to continue.");
      return;
    }

    const normalizedUrl = toRecipeUrl(urlInput);
    if (!normalizedUrl) {
      setUrlError("Please enter a valid recipe URL (for example: https://example.com/recipe).");
      return;
    }

    setConverting(true);

    try {
      const response = await fetch("/api/parse-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: normalizedUrl }),
        cache: "no-store"
      });

      const payload = (await response.json()) as
        | { recipe: ParsedRecipe }
        | ErrorResponse;

      if (!response.ok || isErrorResponse(payload)) {
        throw new Error(
          isErrorResponse(payload)
            ? payload.error
            : "Recipe conversion failed. Please try another recipe page."
        );
      }

      const recipeId = createRecipeId(payload.recipe.title);
      localStorage.setItem(recipeStorageKey(recipeId), JSON.stringify(payload.recipe));
      router.push(`/recipe/${recipeId}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Recipe conversion failed.";

      if (/valid recipe url|paste a recipe url/i.test(message)) {
        setUrlError(message);
      } else {
        setRequestError(message);
      }
    } finally {
      setConverting(false);
    }
  }

  return (
    <main className="soft-grid relative min-h-screen bg-canvas bg-hero-radial px-4 py-10 sm:px-6 lg:px-12">
      <div className="mx-auto w-full max-w-6xl">
        <SiteNav className="mb-4" />

        <section className="card overflow-hidden border-white/90 p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <BrandLogo variant="full" className="mb-4" />
              <h1 className="mb-4 text-4xl leading-tight text-ink sm:text-5xl">
                Paste a recipe link to turn it into simple cooking flashcards
              </h1>
              <p className="max-w-xl text-base text-mist sm:text-lg">
                Drop in a recipe URL and RecipeCards instantly converts it into a
                cleaner, step-by-step cooking interface designed for real kitchen
                use.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.14em] text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Flashcard Steps
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Smart Timers
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Mobile Ready
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70 p-5 sm:p-6">
              <label
                htmlFor="recipe-url"
                className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
              >
                Paste Recipe Link
              </label>
              <input
                id="recipe-url"
                type="url"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleConvert();
                  }
                }}
                placeholder="https://www.allrecipes.com/recipe/..."
                aria-invalid={Boolean(urlError)}
                className={`w-full rounded-2xl border bg-white px-4 py-3 text-base text-ink outline-none transition ${
                  urlError
                    ? "border-rose-300 ring-2 ring-rose-200/70"
                    : "border-slate-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
                }`}
              />
              <p className="mt-2 text-xs text-mist">
                Works best with recipe pages from major cooking sites.
              </p>
              <button
                type="button"
                onClick={() => setUrlInput(EXAMPLE_RECIPE_URL)}
                className="mt-2 inline-flex text-xs font-semibold text-accent transition hover:text-emerald-700"
              >
                Try an example link
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleConvert();
                }}
                disabled={converting}
                className="mt-5 w-full rounded-2xl bg-ink px-5 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {converting ? "Converting recipe..." : "Create Flashcards"}
              </button>

              {urlError ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {urlError}
                </p>
              ) : null}

              {requestError ? (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {requestError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8 card border-white/90 p-6 sm:p-8">
          <h2 className="text-2xl text-ink sm:text-3xl">How It Works</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Step 1
              </p>
              <h3 className="text-lg text-ink">Paste a recipe link</h3>
              <p className="mt-1 text-sm text-slate-600">
                Copy any supported recipe URL and drop it into the input.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Step 2
              </p>
              <h3 className="text-lg text-ink">We extract the recipe</h3>
              <p className="mt-1 text-sm text-slate-600">
                Ingredients and instructions are parsed into clean structured data.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Step 3
              </p>
              <h3 className="text-lg text-ink">Cook step-by-step with flashcards</h3>
              <p className="mt-1 text-sm text-slate-600">
                Follow each step in sequence with timers and focused controls.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-8 card border-white/90 p-6 sm:p-8">
          <h2 className="text-2xl text-ink sm:text-3xl">Why RecipeCards</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefitCards.map((benefit) => (
              <article
                key={benefit.title}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <h3 className="text-lg leading-tight text-ink">{benefit.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{benefit.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-8 mb-4 card border-white/90 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl text-ink sm:text-3xl">Quick Preview</h2>
            <Link
              href="/pricing"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300"
            >
              See Pro Features
            </Link>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Ingredients Checklist
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="rounded-lg bg-slate-100 px-3 py-2">[ ] 2 tbsp olive oil</li>
                <li className="rounded-lg bg-slate-100 px-3 py-2">[ ] 1 onion, diced</li>
                <li className="rounded-lg bg-slate-100 px-3 py-2">[ ] 14 oz crushed tomatoes</li>
              </ul>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Step Card
              </p>
              <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm text-slate-700">
                Saute onion in olive oil for 5 minutes until translucent, then stir
                in tomatoes and simmer.
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Timer Action
              </p>
              <button
                type="button"
                disabled
                className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white"
              >
                Start 10:00 Timer
              </button>
              <p className="mt-3 text-sm text-slate-600">
                Timers stay visible while you move through cooking steps.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
