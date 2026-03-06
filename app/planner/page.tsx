"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SiteNav } from "@/components/site-nav";
import { UpgradeModal } from "@/components/upgrade-modal";
import { MEAL_PLANNER_KEY, getSavedRecipesFromLocalStorage } from "@/lib/local-library";

const PRO_ENABLED = process.env.NEXT_PUBLIC_PRO_ENABLED === "true";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PlannerStore = Record<string, string[]>;
type ShoppingScope = "month" | "selected" | "range";

interface RecipeSummary {
  id: string;
  title: string;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function prettyDateLabel(key: string): string {
  const parsed = new Date(`${key}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric"
  });
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

function buildCalendarDays(monthDate: Date): Date[] {
  const firstDay = startOfMonth(monthDate);
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });
}

function parsePlannerStore(raw: string | null): PlannerStore {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const output: PlannerStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(value)) {
        continue;
      }
      output[key] = value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return output;
  } catch {
    return {};
  }
}

export default function PlannerPage() {
  const router = useRouter();

  const [initialized, setInitialized] = useState(false);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [plannerStore, setPlannerStore] = useState<PlannerStore>({});
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKey(new Date()));
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [shoppingScope, setShoppingScope] = useState<ShoppingScope>("month");
  const [rangeStart, setRangeStart] = useState(() => dateKey(new Date()));
  const [rangeEnd, setRangeEnd] = useState(() => dateKey(new Date()));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const savedRecipes = getSavedRecipesFromLocalStorage().map(({ id, recipe }) => ({
      id,
      title: recipe.title
    }));
    setRecipes(savedRecipes);

    const existing = parsePlannerStore(localStorage.getItem(MEAL_PLANNER_KEY));
    setPlannerStore(existing);
    setInitialized(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(MEAL_PLANNER_KEY, JSON.stringify(plannerStore));
  }, [plannerStore]);

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const recipesById = useMemo(() => {
    return new Map(recipes.map((recipe) => [recipe.id, recipe]));
  }, [recipes]);

  const selectedDateRecipes = useMemo(() => {
    return (plannerStore[selectedDateKey] ?? [])
      .map((id) => recipesById.get(id))
      .filter((recipe): recipe is RecipeSummary => Boolean(recipe));
  }, [plannerStore, recipesById, selectedDateKey]);

  const visibleMonthRecipeIds = useMemo(() => {
    const ids = new Set<string>();
    const month = monthCursor.getMonth();
    const year = monthCursor.getFullYear();

    for (const day of calendarDays) {
      if (day.getMonth() !== month || day.getFullYear() !== year) {
        continue;
      }

      for (const id of plannerStore[dateKey(day)] ?? []) {
        ids.add(id);
      }
    }

    return Array.from(ids);
  }, [calendarDays, monthCursor, plannerStore]);

  const rangeRecipeIds = useMemo(() => {
    if (!rangeStart || !rangeEnd) {
      return [];
    }

    const start = new Date(`${rangeStart}T00:00:00`);
    const end = new Date(`${rangeEnd}T23:59:59`);
    const from = start <= end ? start : end;
    const to = start <= end ? end : start;
    const ids = new Set<string>();

    for (const [key, value] of Object.entries(plannerStore)) {
      const date = new Date(`${key}T00:00:00`);
      if (date < from || date > to) {
        continue;
      }
      for (const id of value) {
        ids.add(id);
      }
    }

    return Array.from(ids);
  }, [plannerStore, rangeEnd, rangeStart]);

  const plannedMealsCount = useMemo(() => {
    return Object.values(plannerStore).reduce((count, value) => count + value.length, 0);
  }, [plannerStore]);

  function goToNextMonth() {
    setMonthCursor((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
  }

  function goToPreviousMonth() {
    setMonthCursor((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
  }

  function addMealToSelectedDate() {
    setStatusMessage(null);

    if (!PRO_ENABLED) {
      setShowUpgradeModal(true);
      return;
    }

    if (!selectedRecipeId) {
      setStatusMessage("Pick a recipe to add for this date.");
      return;
    }

    setPlannerStore((previous) => {
      const existing = previous[selectedDateKey] ?? [];
      if (existing.includes(selectedRecipeId)) {
        return previous;
      }

      return {
        ...previous,
        [selectedDateKey]: [...existing, selectedRecipeId]
      };
    });

    setStatusMessage("Meal added.");
  }

  function removeMeal(date: string, recipeId: string) {
    setPlannerStore((previous) => {
      const existing = previous[date] ?? [];
      const filtered = existing.filter((id) => id !== recipeId);
      const next = { ...previous };

      if (filtered.length) {
        next[date] = filtered;
      } else {
        delete next[date];
      }

      return next;
    });

    setStatusMessage("Meal removed.");
  }

  function clearMonthPlans() {
    const month = monthCursor.getMonth();
    const year = monthCursor.getFullYear();

    setPlannerStore((previous) => {
      const next: PlannerStore = {};
      for (const [key, value] of Object.entries(previous)) {
        const parsed = new Date(`${key}T00:00:00`);
        if (parsed.getMonth() === month && parsed.getFullYear() === year) {
          continue;
        }
        next[key] = value;
      }
      return next;
    });
    setStatusMessage("Visible month cleared.");
  }

  function generateCombinedShoppingList() {
    setStatusMessage(null);

    if (!PRO_ENABLED) {
      setShowUpgradeModal(true);
      return;
    }

    const ids =
      shoppingScope === "selected"
        ? Array.from(new Set(plannerStore[selectedDateKey] ?? []))
        : shoppingScope === "range"
          ? rangeRecipeIds
          : visibleMonthRecipeIds;

    if (!ids.length) {
      setStatusMessage(
        shoppingScope === "selected"
          ? "No meals on this date yet."
          : shoppingScope === "range"
            ? "No planned meals in this date range yet."
          : "No planned meals in the visible month yet."
      );
      return;
    }

    router.push(`/shopping-list?recipes=${encodeURIComponent(ids.join(","))}`);
  }

  return (
    <main className="soft-grid min-h-screen bg-canvas bg-hero-radial px-4 py-8 sm:px-6">
      <UpgradeModal
        open={showUpgradeModal}
        feature="Meal Planner + Combined Shopping List"
        onClose={() => setShowUpgradeModal(false)}
      />

      <div className="mx-auto max-w-6xl space-y-6">
        <SiteNav />

        <section className="card border-white/90 p-6 sm:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl text-ink sm:text-4xl">Meal Planner</h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Plan meals on a calendar and build shopping lists from planned dates.
              </p>
              {initialized && recipes.length > 0 && plannedMealsCount === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No meals planned yet. Select a date and add your first recipe.
                </p>
              ) : null}
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              {plannedMealsCount} meals planned
            </span>
          </div>

          {!initialized ? (
            <div className="grid gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : null}

          {initialized && recipes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/90 p-5 text-sm text-slate-600">
              No saved recipes yet. Save recipes first, then assign them to dates.
            </div>
          ) : null}

          <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Previous
                </button>
                <p className="text-lg font-semibold text-slate-900">{monthLabel(monthCursor)}</p>
                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Next
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarDays.map((day) => {
                  const key = dateKey(day);
                  const inMonth = day.getMonth() === monthCursor.getMonth();
                  const plannedForDay = (plannerStore[key] ?? [])
                    .map((id) => recipesById.get(id)?.title ?? "Saved recipe")
                    .slice(0, 3);
                  const isSelected = selectedDateKey === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDateKey(key)}
                      className={`min-h-[112px] rounded-2xl border p-2 text-left transition ${
                        isSelected
                          ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      } ${!inMonth ? "opacity-45" : ""}`}
                      aria-label={`Planner date ${key}`}
                    >
                      <p className="mb-1 text-xs font-semibold text-slate-700">{day.getDate()}</p>
                      <div className="space-y-1">
                        {plannedForDay.map((title, index) => (
                          <span
                            key={`${key}-${index}`}
                            className="block truncate rounded-lg bg-slate-100 px-1.5 py-1 text-[10px] text-slate-700"
                          >
                            {title}
                          </span>
                        ))}
                        {(plannerStore[key]?.length ?? 0) > plannedForDay.length ? (
                          <span className="block text-[10px] text-slate-500">
                            +{(plannerStore[key]?.length ?? 0) - plannedForDay.length} more
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">Selected Date</h2>
              <p className="mt-1 text-sm text-slate-600">{prettyDateLabel(selectedDateKey)}</p>

              <div className="mt-4 space-y-2">
                <label className="text-sm text-slate-600">
                  Add recipe
                  <select
                    value={selectedRecipeId}
                    onChange={(event) => setSelectedRecipeId(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    aria-label="Recipe to add"
                  >
                    <option value="">Choose a saved recipe</option>
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.title}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={addMealToSelectedDate}
                  className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add meal
                  {!PRO_ENABLED ? (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white">
                      Pro
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {selectedDateRecipes.length ? (
                  selectedDateRecipes.map((recipe) => (
                    <div
                      key={`${selectedDateKey}-${recipe.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="truncate text-sm text-slate-800">{recipe.title}</span>
                      <button
                        type="button"
                        onClick={() => removeMeal(selectedDateKey, recipe.id)}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    No meals planned for this date yet.
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="text-sm text-slate-600">
                  Shopping list scope
                  <select
                    value={shoppingScope}
                    onChange={(event) => setShoppingScope(event.target.value as ShoppingScope)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    aria-label="Shopping list scope"
                  >
                    <option value="month">Visible month</option>
                    <option value="selected">Selected date only</option>
                    <option value="range">Custom date range</option>
                  </select>
                </label>

                {shoppingScope === "range" ? (
                  <div className="mt-2 grid gap-2">
                    <label className="text-xs text-slate-500">
                      Start date
                      <input
                        type="date"
                        value={rangeStart}
                        onChange={(event) => setRangeStart(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                      />
                    </label>
                    <label className="text-xs text-slate-500">
                      End date
                      <input
                        type="date"
                        value={rangeEnd}
                        onChange={(event) => setRangeEnd(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                      />
                    </label>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={generateCombinedShoppingList}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                >
                  Generate combined shopping list
                </button>
              </div>

              <button
                type="button"
                onClick={clearMonthPlans}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Clear visible month
              </button>

              {statusMessage ? (
                <p className="mt-3 text-sm text-slate-600">{statusMessage}</p>
              ) : null}
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
