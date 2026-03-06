"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent
} from "react";

import { BrandLogo } from "@/components/brand-logo";
import { DetailModeToggle } from "@/components/detail-mode-toggle";
import { TimerPanel } from "@/components/timer-panel";
import { ToastStack } from "@/components/toast-stack";
import { useCookingTimers } from "@/hooks/use-cooking-timers";
import { resolveProAccess } from "@/lib/pro-access";
import { useStoredRecipe } from "@/hooks/use-stored-recipe";
import { parseServingsCount, scaleIngredients } from "@/lib/serving-scale";
import { normalizeSteps } from "@/lib/step-normalizer";
import {
  extractTimerMatches,
  getHighlightedIngredientIndexes
} from "@/lib/step-tools";
import type { DetailLevel } from "@/lib/types";

const { hasProAccess: PRO_ENABLED } = resolveProAccess(
  process.env.NEXT_PUBLIC_PRO_ENABLED === "true"
);

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function sanitizeStepForUi(step: string): string {
  return step
    .replace(/\[(?:step|instruction|directions?|method|section)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function CookingSkeleton() {
  return (
    <main className="fixed inset-0 bg-[#05080f] p-4">
      <div className="h-full w-full animate-pulse rounded-2xl border border-slate-800 bg-[#0e1420]" />
    </main>
  );
}

export default function CookingModePage() {
  const params = useParams();
  const router = useRouter();

  const recipeId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const { recipe, loading, error } = useStoredRecipe(recipeId);

  const [detailLevel, setDetailLevel] = useState<DetailLevel>("simple");
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [ingredientChecks, setIngredientChecks] = useState<boolean[]>([]);
  const [baseServings, setBaseServings] = useState(2);
  const [targetServings, setTargetServings] = useState(2);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);

  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceEnabledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const swipeStartX = useRef<number | null>(null);

  const {
    timers,
    toasts,
    startTimer,
    toggleTimer,
    resetTimer,
    removeTimer,
    dismissToast
  } = useCookingTimers();

  useEffect(() => {
    if (!recipe) {
      return;
    }

    setIngredientChecks(recipe.ingredients.map(() => false));
    const detectedServings = parseServingsCount(recipe.servings) ?? 2;
    setBaseServings(detectedServings);
    setTargetServings(detectedServings);
  }, [recipe]);

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

    if (detailLevel === "detailed" && recipe.stepsDetailed?.length) {
      return recipe.stepsDetailed;
    }

    if (detailLevel === "simple" && recipe.stepsSimple?.length) {
      return recipe.stepsSimple;
    }

    return recipe.steps;
  }, [detailLevel, recipe]);

  const steps = useMemo(() => {
    if (!rawSteps.length) {
      return fallbackSteps
        .slice(0, 30)
        .map((step) => sanitizeStepForUi(step))
        .filter(Boolean);
    }

    const normalized = normalizeSteps(rawSteps, { mode: detailLevel })
      .map((step) => sanitizeStepForUi(step))
      .filter(Boolean);

    if (normalized.length) {
      return normalized;
    }

    return fallbackSteps
      .slice(0, 30)
      .map((step) => sanitizeStepForUi(step))
      .filter(Boolean);
  }, [detailLevel, fallbackSteps, rawSteps]);

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
  const stepCount = steps.length;
  const progress = stepCount
    ? Math.min(((currentStepIndex + 1) / stepCount) * 100, 100)
    : 0;

  const highlightedIngredients = useMemo(
    () => getHighlightedIngredientIndexes(scaledIngredients, currentStep),
    [scaledIngredients, currentStep]
  );

  const timerMatches = useMemo(() => extractTimerMatches(currentStep), [currentStep]);

  const goNext = useCallback(() => {
    setCurrentStepIndex((previous) =>
      Math.min(previous + 1, Math.max(stepCount - 1, 0))
    );
  }, [stepCount]);

  const goPrevious = useCallback(() => {
    setCurrentStepIndex((previous) => Math.max(previous - 1, 0));
  }, []);

  const speakCurrentStep = useCallback(() => {
    if (typeof window === "undefined" || !currentStep) {
      return;
    }

    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentStep));
  }, [currentStep]);

  const handleVoiceCommand = useCallback(
    (transcript: string) => {
      const text = transcript.toLowerCase();

      if (text.includes("next")) {
        goNext();
        setVoiceMessage("Voice: next step");
        return;
      }

      if (text.includes("previous") || text.includes("back")) {
        goPrevious();
        setVoiceMessage("Voice: previous step");
        return;
      }

      if (text.includes("repeat")) {
        speakCurrentStep();
        setVoiceMessage("Voice: repeat step");
        return;
      }

      if (text.includes("start timer")) {
        if (timerMatches[0]) {
          startTimer(timerMatches[0]);
          setVoiceMessage(`Voice: started ${timerMatches[0].label} timer`);
        } else {
          setVoiceMessage("Voice: no timer detected in this step");
        }
      }
    },
    [goNext, goPrevious, speakCurrentStep, startTimer, timerMatches]
  );

  const toggleVoiceRecognition = useCallback(() => {
    if (!PRO_ENABLED) {
      setVoiceMessage("Voice controls are available on Pro.");
      return;
    }

    const recognition = recognitionRef.current;
    if (!recognition || !voiceSupported) {
      setVoiceMessage("Voice recognition is not supported in this browser.");
      return;
    }

    if (voiceEnabledRef.current) {
      voiceEnabledRef.current = false;
      recognition.stop();
      setVoiceListening(false);
      setVoiceMessage("Voice controls paused.");
      return;
    }

    try {
      recognition.start();
      voiceEnabledRef.current = true;
      setVoiceListening(true);
      setVoiceMessage("Listening for voice commands...");
    } catch {
      setVoiceListening(false);
      setVoiceMessage("Could not start voice recognition.");
    }
  }, [voiceSupported]);

  const requestWakeLock = useCallback(async () => {
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock?.request) {
      setWakeLockSupported(false);
      return;
    }

    try {
      wakeLockRef.current = await nav.wakeLock.request("screen");
      setWakeLockSupported(true);
      setWakeLockEnabled(true);
    } catch {
      setWakeLockSupported(false);
      setWakeLockEnabled(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) {
      setWakeLockEnabled(false);
      return;
    }

    try {
      await wakeLockRef.current.release();
    } catch {
      // ignore release failures
    } finally {
      wakeLockRef.current = null;
      setWakeLockEnabled(false);
    }
  }, []);

  const requestFullscreen = useCallback(async () => {
    if (!containerRef.current?.requestFullscreen) {
      setFullscreenFailed(true);
      return;
    }

    try {
      await containerRef.current.requestFullscreen();
      setFullscreenFailed(false);
    } catch {
      setFullscreenFailed(true);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await requestFullscreen();
  }, [requestFullscreen]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    void requestWakeLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void releaseWakeLock();
    };
  }, [releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();

    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!PRO_ENABLED) {
      setVoiceSupported(false);
      return;
    }

    const windowWithSpeech = window as WindowWithSpeechRecognition;
    const SpeechRecognitionCtor =
      windowWithSpeech.SpeechRecognition ?? windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const latestIndex = Math.max(0, event.results.length - 1);
      const transcript = event.results[latestIndex]?.[0]?.transcript?.trim();
      if (transcript) {
        handleVoiceCommand(transcript);
      }
    };
    recognition.onerror = () => {
      setVoiceMessage("Voice recognition error.");
      setVoiceListening(false);
    };
    recognition.onend = () => {
      if (!voiceEnabledRef.current) {
        setVoiceListening(false);
        return;
      }

      try {
        recognition.start();
      } catch {
        setVoiceListening(false);
        voiceEnabledRef.current = false;
      }
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      voiceEnabledRef.current = false;
      recognition.stop();
      recognitionRef.current = null;
      setVoiceListening(false);
    };
  }, [handleVoiceCommand]);

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

  async function exitCookingMode() {
    voiceEnabledRef.current = false;
    recognitionRef.current?.stop();
    await releaseWakeLock();
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    router.push(`/recipe/${recipeId}`);
  }

  function onStepPointerDown(event: PointerEvent<HTMLDivElement>) {
    swipeStartX.current = event.clientX;
  }

  function onStepPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (swipeStartX.current === null) {
      return;
    }

    const delta = event.clientX - swipeStartX.current;
    swipeStartX.current = null;

    if (Math.abs(delta) < 45) {
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

  if (loading) {
    return <CookingSkeleton />;
  }

  if (error || !recipe) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-[#05080f] px-4 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
          <h1 className="mb-3 text-2xl font-semibold">Cooking Mode Not Available</h1>
          <p className="mb-6 text-slate-300">{error ?? "Recipe data is missing."}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#05080f] text-white"
    >
      <ToastStack toasts={toasts} onDismiss={dismissToast} dark />

      <header className="shrink-0 border-b border-slate-800 bg-[#0a1020]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              aria-label="Go to homepage"
              className="inline-flex cursor-pointer items-center"
            >
              <BrandLogo variant="icon" />
            </Link>
            <p className="max-w-[58vw] truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 sm:max-w-[40vw]">
              {recipe.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DetailModeToggle mode={detailLevel} onChange={setDetailLevel} dark />
            <button
              type="button"
              onClick={toggleVoiceRecognition}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                voiceListening
                  ? "border-emerald-300 bg-emerald-300/15 text-emerald-100"
                  : "border-slate-700 text-slate-200"
              }`}
              aria-label="Toggle voice controls"
            >
              {voiceListening ? "Mic On" : "Mic"}
              {!PRO_ENABLED ? (
                <span className="ml-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white">
                  Pro
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200"
            >
              {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            </button>
            <button
              type="button"
              onClick={exitCookingMode}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-200">
          <span>
            Step {Math.min(currentStepIndex + 1, Math.max(stepCount, 1))} of{" "}
            {Math.max(stepCount, 1)}
          </span>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            Jump to step
            <select
              value={currentStepIndex}
              onChange={(event) =>
                setCurrentStepIndex(Number.parseInt(event.target.value, 10) || 0)
              }
              className="rounded-md border border-slate-700 bg-[#0f1528] px-2 py-1 text-xs text-slate-100"
            >
              {steps.map((_, index) => (
                <option key={`cook-step-${index}`} value={index}>
                  Step {index + 1}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {wakeLockSupported ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
              {wakeLockEnabled ? "Screen awake enabled" : "Screen awake pending"}
            </span>
          ) : (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-200">
              Keep-awake unsupported in this browser.
            </span>
          )}
          {fullscreenFailed ? (
            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-200">
              Fullscreen request was blocked.
            </span>
          ) : null}
          {PRO_ENABLED && !voiceSupported ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-200">
              Voice controls unsupported in this browser.
            </span>
          ) : null}
          {PRO_ENABLED && voiceSupported ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
              {voiceListening ? "Voice listening" : "Voice paused"}
            </span>
          ) : null}
          {voiceMessage ? (
            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-200">
              {voiceMessage}
            </span>
          ) : null}
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden px-4 py-5 sm:px-6 sm:py-7">
        <div className="mx-auto flex h-full max-w-5xl flex-col justify-center gap-5">
          <article
            onPointerDown={onStepPointerDown}
            onPointerUp={onStepPointerUp}
            key={`${detailLevel}-${currentStepIndex}`}
            className="rounded-3xl border border-slate-700 bg-gradient-to-b from-[#111a30] to-[#0b1223] px-6 py-8 text-center shadow-soft sm:px-10 sm:py-12"
          >
            <p className="mx-auto max-w-[24ch] text-3xl leading-tight text-white sm:text-5xl sm:leading-tight">
              {currentStep || "No instruction available for this step."}
            </p>

            {timerMatches.length ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {timerMatches.map((match) => (
                  <button
                    key={`${match.label}-${match.seconds}`}
                    type="button"
                    onClick={() => startTimer(match)}
                    className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-300"
                  >
                    Start {match.label} timer
                  </button>
                ))}
              </div>
            ) : null}
          </article>

          <details className="rounded-2xl border border-slate-700 bg-[#0b1223]/80 p-3 text-sm">
            <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
              Ingredients ({highlightedIngredients.size} highlighted in this step)
            </summary>

            <div className="mt-3">
              <div className="mb-3 rounded-xl border border-slate-700 bg-[#0f1528] p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                  <span>Servings</span>
                  <span>{targetServings}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateServings(targetServings - 1)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    value={targetServings}
                    onChange={(event) => updateServings(Number(event.target.value))}
                    className="h-2 flex-1 accent-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => updateServings(targetServings + 1)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                {scaledIngredients.map((ingredient, index) => {
                  const checked = ingredientChecks[index] ?? false;
                  const highlighted = highlightedIngredients.has(index);

                  return (
                    <label
                      key={`${ingredient}-${index}`}
                      className={`flex cursor-pointer gap-2 rounded-lg px-2 py-1 ${
                        checked
                          ? "bg-emerald-500/20 text-emerald-200"
                          : highlighted
                            ? "bg-amber-400/20 text-amber-100"
                            : "hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIngredient(index)}
                        className="mt-1 h-3.5 w-3.5"
                      />
                      <span>{ingredient}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </details>
        </div>
      </section>

      <footer className="shrink-0 border-t border-slate-800 bg-[#0a1020]/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-5xl space-y-3">
          <TimerPanel
            timers={timers}
            onToggle={toggleTimer}
            onReset={resetTimer}
            onRemove={removeTimer}
            dark
            variant="tray"
          />

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={goPrevious}
              disabled={currentStepIndex === 0}
              className={`rounded-2xl px-4 py-4 text-lg font-semibold transition ${
                currentStepIndex === 0
                  ? "cursor-not-allowed bg-slate-700 text-slate-400"
                  : "bg-slate-800 text-slate-100 hover:bg-slate-700"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentStepIndex >= stepCount - 1}
              className={`rounded-2xl px-4 py-4 text-lg font-semibold transition ${
                currentStepIndex >= stepCount - 1
                  ? "cursor-not-allowed bg-slate-700 text-slate-400"
                  : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
