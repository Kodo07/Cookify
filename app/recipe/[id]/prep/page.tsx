"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { QuickFactsBar } from "@/components/quick-facts-bar";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useAiStatus } from "@/hooks/use-ai-status";
import { useStoredRecipe } from "@/hooks/use-stored-recipe";
import { normalizeSteps } from "@/lib/step-normalizer";
import { extractPrepTasks } from "@/lib/step-tools";

interface PrepTasksResponse {
  tasks?: string[];
  error?: string;
}

const PRO_ENABLED = process.env.NEXT_PUBLIC_PRO_ENABLED === "true";

function PrepSkeleton() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="card h-40 p-6" />
        <div className="card h-96 p-6" />
      </div>
    </main>
  );
}

export default function PrepModePage() {
  const params = useParams();
  const recipeId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const { recipe, loading, error } = useStoredRecipe(recipeId);
  const { configured: aiConfigured, loading: aiStatusLoading } =
    useAiStatus(PRO_ENABLED);

  const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
  const [aiTasks, setAiTasks] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const rawSteps = useMemo(() => {
    if (!recipe) {
      return [];
    }

    if (recipe.rawInstructions?.length) {
      return recipe.rawInstructions;
    }

    if (recipe.stepsDetailed?.length) {
      return recipe.stepsDetailed;
    }

    return recipe.steps;
  }, [recipe]);

  const heuristicPrepTasks = useMemo(() => {
    if (!rawSteps.length) {
      return [];
    }

    const detailed = normalizeSteps(rawSteps, { mode: "detailed" });
    return extractPrepTasks(detailed);
  }, [rawSteps]);

  const prepTasks = useMemo(() => {
    if (aiTasks?.length) {
      return aiTasks;
    }
    return heuristicPrepTasks;
  }, [aiTasks, heuristicPrepTasks]);

  useEffect(() => {
    setAiTasks(null);
    setAiError(null);
    setCheckedTasks({});
  }, [recipeId]);

  function toggleTask(index: number) {
    setCheckedTasks((previous) => ({
      ...previous,
      [index]: !previous[index]
    }));
  }

  function useHeuristicList() {
    setAiTasks(null);
    setAiError(null);
    setCheckedTasks({});
  }

  async function handleGenerateAiPrepTasks() {
    if (!PRO_ENABLED) {
      setShowUpgradeModal(true);
      return;
    }

    if (aiStatusLoading) {
      return;
    }

    if (!aiConfigured) {
      setAiError("AI not configured on server. Add HF_TOKEN to enable AI prep.");
      return;
    }

    if (!recipe || !rawSteps.length || aiLoading) {
      return;
    }

    setAiError(null);
    setAiLoading(true);

    try {
      const response = await fetch("/api/ai/prepTasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: recipe.title,
          ingredients: recipe.ingredients,
          steps: rawSteps
        }),
        cache: "no-store"
      });

      const payload = (await response.json()) as PrepTasksResponse;
      if (!response.ok || !Array.isArray(payload.tasks)) {
        throw new Error(payload.error ?? "AI prep task generation failed.");
      }

      const cleaned = payload.tasks
        .map((task) => task.trim())
        .filter(Boolean)
        .slice(0, 14);

      if (!cleaned.length) {
        throw new Error("AI returned an empty prep list.");
      }

      setAiTasks(cleaned);
      setCheckedTasks({});
    } catch (requestError) {
      setAiError(
        requestError instanceof Error
          ? requestError.message
          : "AI prep task generation failed."
      );
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return <PrepSkeleton />;
  }

  if (error || !recipe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="card max-w-lg p-8 text-center">
          <h1 className="mb-3 text-3xl text-ink">Prep Mode Not Available</h1>
          <p className="mb-6 text-slate-600">{error ?? "Recipe data is missing."}</p>
          <Link
            href="/"
            className="inline-flex rounded-xl bg-ink px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6">
      <UpgradeModal
        open={showUpgradeModal}
        feature="AI Prep List"
        onClose={() => setShowUpgradeModal(false)}
      />

      <div className="mx-auto max-w-5xl space-y-6">
        <header className="card p-6">
          <Link
            href="/"
            aria-label="Go to homepage"
            className="mb-3 inline-flex w-fit cursor-pointer items-center"
          >
            <BrandLogo variant="full" />
          </Link>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/recipe/${recipeId}`}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Back
              </Link>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              Prep Mode
            </span>
          </div>

          <h1 className="mb-4 text-3xl leading-tight text-ink sm:text-4xl">{recipe.title}</h1>

          <QuickFactsBar
            prepTime={recipe.prepTime}
            cookTime={recipe.cookTime}
            totalTime={recipe.totalTime}
            servings={recipe.servings}
          />
        </header>

        <section className="card p-6">
          <h2 className="mb-2 text-2xl text-ink">Before You Start Cooking</h2>
          <p className="mb-5 text-sm text-slate-600">
            Complete these prep tasks first, then jump into distraction-free cooking mode.
          </p>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateAiPrepTasks}
              disabled={aiLoading || !rawSteps.length}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {aiLoading ? "Generating..." : "\u2728 Generate Prep List"}
              {!PRO_ENABLED ? (
                <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white">
                  Pro
                </span>
              ) : null}
            </button>
            {aiTasks?.length ? (
              <button
                type="button"
                onClick={useHeuristicList}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Use Heuristic List
              </button>
            ) : null}
            {aiTasks?.length ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                AI prep list enabled
              </span>
            ) : null}
          </div>

          {PRO_ENABLED && aiConfigured === false ? (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              AI not configured on server. Add HF_TOKEN to enable AI prep list.
            </p>
          ) : null}

          {aiError ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {aiError}
            </p>
          ) : null}

          <div className="space-y-2">
            {prepTasks.map((task, index) => (
              <label
                key={`${task}-${index}`}
                className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 transition ${
                  checkedTasks[index] ? "bg-emerald-50 text-emerald-800" : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(checkedTasks[index])}
                  onChange={() => toggleTask(index)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                />
                <span className={checkedTasks[index] ? "line-through" : ""}>{task}</span>
              </label>
            ))}
            {!prepTasks.length ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Prep tasks were not detected from this recipe. Start cooking mode to
                run through steps directly.
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/recipe/${recipeId}/cook`}
              className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Start Cooking
            </Link>
            <Link
              href={`/recipe/${recipeId}`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Back to Recipe View
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
