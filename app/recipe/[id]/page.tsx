"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent
} from "react";

import { BrandLogo } from "@/components/brand-logo";
import { QuickFactsBar } from "@/components/quick-facts-bar";
import { TimerPanel } from "@/components/timer-panel";
import { ToastStack } from "@/components/toast-stack";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useAiStatus } from "@/hooks/use-ai-status";
import { useCookingTimers, type TimerToast } from "@/hooks/use-cooking-timers";
import { useStoredRecipe } from "@/hooks/use-stored-recipe";
import { isRecipeSavedLocally, markRecipeSavedLocally } from "@/lib/local-library";
import { resolveProAccess } from "@/lib/pro-access";
import { parseServingsCount, scaleIngredients } from "@/lib/serving-scale";
import { normalizeSteps } from "@/lib/step-normalizer";
import {
  extractTimerMatches,
  getHighlightedIngredientIndexes
} from "@/lib/step-tools";

type StepEngine = "normal" | "ai";

interface FlashcardsResponse {
  steps?: string[];
  cached?: boolean;
  aiEnhanced?: boolean;
  error?: string;
}

interface SubstituteResponse {
  substitutions?: string[];
  error?: string;
  fallback?: boolean;
}

const { betaAllPro: BETA_ALL_PRO_ENABLED, hasProAccess: PRO_ENABLED } = resolveProAccess(
  process.env.NEXT_PUBLIC_PRO_ENABLED === "true"
);

function RecipeSkeleton() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="card h-52 p-6" />
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <div className="card h-[34rem] p-6" />
          <div className="card h-[34rem] p-6" />
        </div>
      </div>
    </main>
  );
}

function sanitizeStepForUi(step: string): string {
  return step
    .replace(/\[(?:step|instruction|directions?|method|section)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function RecipePage() {
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

  const [stepEngine, setStepEngine] = useState<StepEngine>("normal");
  const [ingredientChecks, setIngredientChecks] = useState<boolean[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [baseServings, setBaseServings] = useState(2);
  const [targetServings, setTargetServings] = useState(2);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("AI Flashcards");
  const [uiToasts, setUiToasts] = useState<TimerToast[]>([]);
  const [aiSteps, setAiSteps] = useState<string[]>([]);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [aiFlashcardsLoading, setAiFlashcardsLoading] = useState(false);
  const [aiFlashcardsError, setAiFlashcardsError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [substitutionsByIndex, setSubstitutionsByIndex] = useState<
    Record<number, string[]>
  >({});
  const [substituteLoadingIndex, setSubstituteLoadingIndex] = useState<number | null>(
    null
  );
  const pointerStartX = useRef<number | null>(null);

  const {
    timers,
    toasts,
    startTimer,
    toggleTimer,
    resetTimer,
    removeTimer,
    dismissToast
  } = useCookingTimers();

  const allToasts = useMemo(() => [...uiToasts, ...toasts], [uiToasts, toasts]);

  const dismissAnyToast = useCallback(
    (id: string) => {
      setUiToasts((previous) => previous.filter((toast) => toast.id !== id));
      dismissToast(id);
    },
    [dismissToast]
  );

  const pushUiToast = useCallback((message: string) => {
    const id = `ui-${Date.now().toString(36)}-${Math.random()
      .toString(16)
      .slice(2, 7)}`;
    setUiToasts((previous) => [{ id, message }, ...previous].slice(0, 4));
  }, []);

  useEffect(() => {
    if (!recipe) {
      return;
    }

    setIngredientChecks(recipe.ingredients.map(() => false));
    const detectedServings = parseServingsCount(recipe.servings) ?? 2;
    setBaseServings(detectedServings);
    setTargetServings(detectedServings);
  }, [recipe]);

  useEffect(() => {
    setAiSteps([]);
    setAiEnhanced(false);
    setAiFlashcardsError(null);
    setStepEngine("normal");
    setUiToasts([]);
    setSubstitutionsByIndex({});
    setSubstituteLoadingIndex(null);
    setIsSaved(isRecipeSavedLocally(recipeId));
  }, [recipeId]);

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

    if (recipe.stepsSimple?.length) {
      return recipe.stepsSimple;
    }

    return recipe.steps;
  }, [recipe]);

  const fallbackSteps = useMemo(() => {
    if (!recipe) {
      return [];
    }

    if (recipe.stepsSimple?.length) {
      return recipe.stepsSimple;
    }

    if (recipe.stepsDetailed?.length) {
      return recipe.stepsDetailed;
    }

    return recipe.steps;
  }, [recipe]);

  const deterministicSteps = useMemo(() => {
    if (!rawSteps.length) {
      return fallbackSteps
        .slice(0, 30)
        .map((step) => sanitizeStepForUi(step))
        .filter(Boolean);
    }

    const normalized = normalizeSteps(rawSteps, { mode: "simple" })
      .map((step) => sanitizeStepForUi(step))
      .filter(Boolean);

    if (normalized.length) {
      return normalized;
    }

    return fallbackSteps
      .slice(0, 30)
      .map((step) => sanitizeStepForUi(step))
      .filter(Boolean);
  }, [fallbackSteps, rawSteps]);

  const aiModeSteps = useMemo(() => {
    return aiSteps
      .map((step) => sanitizeStepForUi(step))
      .filter(Boolean)
      .slice(0, 30);
  }, [aiSteps]);

  const steps =
    stepEngine === "ai" && aiModeSteps.length ? aiModeSteps : deterministicSteps;

  const aiEnhancedActive = stepEngine === "ai" && aiEnhanced;

  const loadAiFlashcards = useCallback(async () => {
    if (!recipe || !rawSteps.length) {
      return;
    }

    setAiFlashcardsLoading(true);
    setAiFlashcardsError(null);

    try {
      const response = await fetch("/api/ai/flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: recipe.title,
          ingredients: recipe.ingredients,
          rawSteps,
          mode: "simple"
        }),
        cache: "no-store"
      });

      const payload = (await response.json()) as FlashcardsResponse;
      if (!response.ok || !Array.isArray(payload.steps)) {
        throw new Error(payload.error ?? "AI flashcard generation failed.");
      }

      const cleaned = payload.steps
        .map((step) => sanitizeStepForUi(step))
        .filter(Boolean)
        .slice(0, 30);

      if (!cleaned.length) {
        throw new Error("AI returned an empty flashcard step list.");
      }

      setAiSteps(cleaned);
      setAiEnhanced(Boolean(payload.aiEnhanced));

      if (payload.aiEnhanced === false) {
        pushUiToast("AI output unavailable. Using deterministic flashcards.");
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "AI flashcard generation failed.";
      setAiFlashcardsError(message);
      pushUiToast(message);
      setStepEngine("normal");
    } finally {
      setAiFlashcardsLoading(false);
    }
  }, [pushUiToast, rawSteps, recipe]);

  useEffect(() => {
    if (
      stepEngine !== "ai" ||
      aiFlashcardsLoading ||
      !PRO_ENABLED ||
      !aiConfigured ||
      aiSteps.length
    ) {
      return;
    }

    void loadAiFlashcards();
  }, [
    aiConfigured,
    aiFlashcardsLoading,
    aiSteps,
    loadAiFlashcards,
    stepEngine
  ]);

  useEffect(() => {
    setCurrentStepIndex((previous) =>
      Math.min(previous, Math.max(steps.length - 1, 0))
    );
  }, [steps.length]);

  const servingsRatio = useMemo(() => {
    if (!baseServings || !targetServings) {
      return 1;
    }
    return targetServings / baseServings;
  }, [baseServings, targetServings]);

  const scaledIngredients = useMemo(() => {
    if (!recipe) {
      return [];
    }
    return scaleIngredients(recipe.ingredients, servingsRatio);
  }, [recipe, servingsRatio]);

  const currentStep = steps[currentStepIndex] ?? "";

  const highlightedIngredients = useMemo(
    () => getHighlightedIngredientIndexes(scaledIngredients, currentStep),
    [scaledIngredients, currentStep]
  );

  const timerMatches = useMemo(() => extractTimerMatches(currentStep), [currentStep]);

  const stepCount = steps.length;
  const progress = stepCount
    ? Math.min(((currentStepIndex + 1) / stepCount) * 100, 100)
    : 0;

  const goNext = useCallback(() => {
    setCurrentStepIndex((previous) =>
      Math.min(previous + 1, Math.max(stepCount - 1, 0))
    );
  }, [stepCount]);

  const goPrevious = useCallback(() => {
    setCurrentStepIndex((previous) => Math.max(previous - 1, 0));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious]);

  function onCardPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStartX.current = event.clientX;
  }

  function onCardPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null) {
      return;
    }

    const delta = event.clientX - pointerStartX.current;
    pointerStartX.current = null;

    if (Math.abs(delta) < 50) {
      return;
    }

    if (delta < 0) {
      goNext();
    } else {
      goPrevious();
    }
  }

  function toggleIngredient(index: number) {
    setIngredientChecks((previous) =>
      previous.map((checked, currentIndex) =>
        currentIndex === index ? !checked : checked
      )
    );
  }

  function updateServings(next: number) {
    const bounded = Math.min(24, Math.max(1, Math.round(next)));
    setTargetServings(bounded);
  }

  async function handleSaveRecipe() {
    if (!recipe || !recipeId || savingRecipe) {
      return;
    }

    setSavingRecipe(true);
    markRecipeSavedLocally(recipeId);
    setIsSaved(true);
    pushUiToast("Recipe saved to your library.");

    try {
      const response = await fetch("/api/recipes/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: recipeId,
          recipe
        }),
        cache: "no-store"
      });

      if (!response.ok) {
        pushUiToast("Saved locally. Server library sync failed.");
      }
    } catch {
      pushUiToast("Saved locally. Server library sync failed.");
    } finally {
      setSavingRecipe(false);
    }
  }

  async function handleSubstitute(index: number, ingredient: string) {
    if (!PRO_ENABLED) {
      setUpgradeFeature("AI Ingredient Substitutions");
      setShowUpgradeModal(true);
      return;
    }

    if (aiStatusLoading) {
      pushUiToast("Checking AI availability...");
      return;
    }

    setSubstituteLoadingIndex(index);

    try {
      const response = await fetch("/api/ai/substitute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ingredient
        }),
        cache: "no-store"
      });

      const payload = (await response.json()) as SubstituteResponse;
      if (!response.ok || !Array.isArray(payload.substitutions)) {
        throw new Error(payload.error ?? "Substitutions not available.");
      }

      const substitutions = payload.substitutions
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8);

      if (!substitutions.length) {
        throw new Error("No practical substitutions returned.");
      }

      setSubstitutionsByIndex((previous) => ({
        ...previous,
        [index]: substitutions
      }));

      if (payload.fallback) {
        pushUiToast("Using smart fallback substitutions.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Substitution request failed.";
      pushUiToast(message);
    } finally {
      setSubstituteLoadingIndex(null);
    }
  }

  function setStepEngineSafely(engine: StepEngine) {
    if (engine === "normal") {
      setStepEngine("normal");
      return;
    }

    if (!PRO_ENABLED) {
      setUpgradeFeature("AI Flashcards");
      setShowUpgradeModal(true);
      return;
    }

    if (aiStatusLoading) {
      pushUiToast("Checking AI availability...");
      return;
    }

    if (!aiConfigured) {
      const message = "AI not configured. Ask admin to set HF_TOKEN.";
      setAiFlashcardsError(message);
      pushUiToast(message);
      return;
    }

    setStepEngine("ai");
  }

  function handleAiFlashcardsClick() {
    if (stepEngine === "ai") {
      setStepEngine("normal");
      return;
    }

    setStepEngineSafely("ai");
  }

  const secondaryActionClass =
    "inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300";

  if (loading) {
    return <RecipeSkeleton />;
  }

  if (error || !recipe) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="card max-w-lg p-8 text-center">
          <h1 className="mb-3 text-3xl text-ink">Recipe Not Available</h1>
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
    <main className="min-h-screen bg-canvas bg-hero-radial px-4 py-6 sm:px-6">
      <ToastStack toasts={allToasts} onDismiss={dismissAnyToast} />
      {!BETA_ALL_PRO_ENABLED ? (
        <UpgradeModal
          open={showUpgradeModal}
          feature={upgradeFeature}
          onClose={() => setShowUpgradeModal(false)}
        />
      ) : null}

      <div className="mx-auto max-w-6xl space-y-6">
        <header className="card border-white/90 p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/"
                aria-label="Go to homepage"
                className="inline-flex cursor-pointer items-center"
              >
                <BrandLogo variant="full" />
              </Link>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                {Math.max(stepCount, 1)} steps
              </span>
            </div>

            <div>
              <h1 className="text-3xl leading-tight text-ink sm:text-4xl">
                {recipe.title}
              </h1>
              {!isSaved ? (
                <p className="mt-2 text-sm text-slate-600">
                  Tip: save this recipe to include it in Planner and Smart Grocery
                  List.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 xl:grid-cols-[auto_1fr_auto] xl:items-start">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                <Link href="/" className={secondaryActionClass}>
                  Back
                </Link>
                <Link href="/pantry" className={secondaryActionClass}>
                  Pantry
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                <button
                  type="button"
                  onClick={handleAiFlashcardsClick}
                  className={
                    stepEngine === "ai"
                      ? "inline-flex h-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400"
                      : secondaryActionClass
                  }
                >
                  {stepEngine === "ai" ? "AI Flashcards On" : "\u2728 AI Flashcards"}
                  {!PRO_ENABLED ? (
                    <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white">
                      Pro
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  disabled={savingRecipe}
                  className={`${secondaryActionClass} disabled:cursor-not-allowed disabled:opacity-55`}
                >
                  {savingRecipe ? "Saving..." : isSaved ? "Saved" : "Save Recipe"}
                </button>

                <Link href={`/recipe/${recipeId}/prep`} className={secondaryActionClass}>
                  Prep Mode
                </Link>
                <Link
                  href={`/shopping-list?recipes=${encodeURIComponent(recipeId)}`}
                  className={secondaryActionClass}
                >
                  Shopping List
                  {!PRO_ENABLED ? (
                    <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white">
                      Pro
                    </span>
                  ) : null}
                </Link>
              </div>

              <div className="flex xl:justify-end">
                <Link
                  href={`/recipe/${recipeId}/cook`}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
                >
                  Start Cooking Mode
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <QuickFactsBar
              prepTime={recipe.prepTime}
              cookTime={recipe.cookTime}
              totalTime={recipe.totalTime}
              servings={recipe.servings}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {stepEngine === "ai" ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                {aiEnhancedActive ? "AI enhanced" : "AI fallback"}
              </span>
            ) : null}
            {PRO_ENABLED && aiConfigured === false ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                AI not configured on server. Flashcards and prep AI are unavailable,
                but substitutions still use smart fallback suggestions.
              </p>
            ) : null}
            {aiFlashcardsLoading ? (
              <span className="text-sm text-slate-600">Building AI flashcards...</span>
            ) : null}
            {aiFlashcardsError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {aiFlashcardsError}
              </p>
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Servings Scaler
              </p>
              <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-800">
                {targetServings} servings
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => updateServings(targetServings - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                -
              </button>
              <input
                type="range"
                min={1}
                max={24}
                value={targetServings}
                onChange={(event) => updateServings(Number(event.target.value))}
                className="h-2 w-48 accent-accent"
              />
              <button
                type="button"
                onClick={() => updateServings(targetServings + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                +
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-2xl text-ink">Ingredients</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                {scaledIngredients.length} items
              </span>
            </div>
            <div className="space-y-2">
              {scaledIngredients.map((ingredient, index) => {
                const checked = ingredientChecks[index] ?? false;
                const highlighted = highlightedIngredients.has(index);
                const substitutions = substitutionsByIndex[index] ?? [];
                const substituteLoading = substituteLoadingIndex === index;

                return (
                  <div
                    key={`${ingredient}-${index}`}
                    className={`rounded-xl px-3 py-2 transition ${
                      checked
                        ? "bg-emerald-50 text-emerald-800"
                        : highlighted
                          ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                          : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleIngredient(index)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                        />
                        <span className={checked ? "line-through" : ""}>{ingredient}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSubstitute(index, ingredient)}
                        disabled={substituteLoading}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Find substitutions for ${ingredient}`}
                      >
                        {substituteLoading ? "Loading..." : "Substitute"}
                        {!PRO_ENABLED ? (
                          <span className="ml-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white">
                            Pro
                          </span>
                        ) : null}
                      </button>
                    </div>

                    {substitutions.length ? (
                      <ul className="mt-2 space-y-1 pl-7 text-xs text-slate-600">
                        {substitutions.map((item, itemIndex) => (
                          <li key={`${ingredient}-sub-${itemIndex}`}>- {item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="card overflow-hidden border-white/90 p-0">
              <div className="px-6 pt-5 sm:px-8">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-slate-600">
                  <span>
                    Step {Math.min(currentStepIndex + 1, Math.max(stepCount, 1))} of{" "}
                    {Math.max(stepCount, 1)}
                  </span>
                  <select
                    aria-label="Jump to step"
                    value={currentStepIndex}
                    onChange={(event) =>
                      setCurrentStepIndex(
                        Number.parseInt(event.target.value, 10) || 0
                      )
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    {steps.map((_, index) => (
                      <option key={`jump-${index}`} value={index}>
                        Step {index + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="step-progress h-full bg-accent"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div
                role="region"
                aria-label="Step card"
                onPointerDown={onCardPointerDown}
                onPointerUp={onCardPointerUp}
                key={`${stepEngine}-${currentStepIndex}`}
                className="flashcard px-6 pb-6 sm:px-8 sm:pb-8"
              >
                <p className="max-w-[60ch] text-2xl leading-relaxed text-slate-900 sm:text-3xl">
                  {currentStep || "No instruction available for this step."}
                </p>

                {timerMatches.length ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {timerMatches.map((match) => (
                      <button
                        key={`${match.label}-${match.seconds}`}
                        type="button"
                        onClick={() => startTimer(match)}
                        className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                      >
                        Start {match.label} timer
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={goPrevious}
                disabled={currentStepIndex === 0}
                className={`rounded-2xl px-4 py-4 text-base font-semibold transition ${
                  currentStepIndex === 0
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : "bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                Previous Step
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={currentStepIndex >= stepCount - 1}
                className={`rounded-2xl px-4 py-4 text-base font-semibold transition ${
                  currentStepIndex >= stepCount - 1
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : "bg-ink text-white hover:bg-slate-800"
                }`}
              >
                Next Step
              </button>
            </div>

            <TimerPanel
              timers={timers}
              onToggle={toggleTimer}
              onReset={resetTimer}
              onRemove={removeTimer}
              variant="tray"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
