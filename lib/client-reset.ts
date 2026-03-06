"use client";

import { MEAL_PLANNER_KEY, SAVED_RECIPE_IDS_KEY } from "@/lib/local-library";

export const CLIENT_RESET_EXACT_KEYS = [
  SAVED_RECIPE_IDS_KEY,
  MEAL_PLANNER_KEY,
  "recipecards:shopping-list:v1",
  "recipecards:pantry:v1",
  "recipecards:recently-viewed:v1"
] as const;

export const CLIENT_RESET_PREFIXES = ["recipecards:"] as const;

export function clearClientDemoData(): {
  localStorageRemoved: string[];
  sessionStorageCleared: boolean;
} {
  const removedKeys = new Set<string>();

  if (typeof window === "undefined") {
    return {
      localStorageRemoved: [],
      sessionStorageCleared: false
    };
  }

  for (const key of CLIENT_RESET_EXACT_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      removedKeys.add(key);
    }
  }

  const allKeys = Object.keys(localStorage);
  for (const key of allKeys) {
    if (CLIENT_RESET_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
      removedKeys.add(key);
    }
  }

  sessionStorage.clear();

  return {
    localStorageRemoved: Array.from(removedKeys),
    sessionStorageCleared: true
  };
}
