export interface TimerMatch {
  label: string;
  seconds: number;
}

const TIMER_REGEX =
  /(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|hr|minutes?|mins?|minute|min|seconds?|secs?|sec)\b/gi;

const STOP_WORDS = new Set([
  "and",
  "for",
  "the",
  "with",
  "into",
  "from",
  "over",
  "your",
  "until",
  "about",
  "that",
  "this",
  "each",
  "than",
  "while",
  "through"
]);

const UNIT_WORDS = new Set([
  "cup",
  "cups",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "tsp",
  "teaspoon",
  "teaspoons",
  "ounce",
  "ounces",
  "oz",
  "gram",
  "grams",
  "g",
  "kg",
  "ml",
  "l",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "pinch",
  "dash"
]);

const PREP_PATTERNS = [
  /\bpreheat\b/i,
  /\bchop\b/i,
  /\bslice\b/i,
  /\bdice\b/i,
  /\bmince\b/i,
  /\bmeasure\b/i,
  /\bwhisk\b/i,
  /\bmix\b/i,
  /\bmarinate\b/i,
  /\brinse\b/i,
  /\bdrain\b/i,
  /\bpat dry\b/i,
  /\bseason\b/i
];

function cleanText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSeconds(amount: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("hour") || normalized === "hr" || normalized === "hrs") {
    return Math.round(amount * 3600);
  }
  if (normalized.startsWith("min")) {
    return Math.round(amount * 60);
  }
  return Math.round(amount);
}

export function extractTimerMatches(stepText: string): TimerMatch[] {
  const dedupe = new Set<string>();
  const output: TimerMatch[] = [];

  for (const match of stepText.matchAll(TIMER_REGEX)) {
    const start = Number.parseFloat(match[1] ?? "0");
    const end = Number.parseFloat(match[2] ?? match[1] ?? "0");
    const unit = (match[3] ?? "").toLowerCase();

    if (!start || !end || !unit) {
      continue;
    }

    const maxValue = Math.max(start, end);
    const seconds = toSeconds(maxValue, unit);
    if (seconds <= 0) {
      continue;
    }

    const label =
      match[2] && match[2] !== match[1]
        ? `${match[1]}-${match[2]} ${unit}`
        : `${match[1]} ${unit}`;
    const key = `${label}-${seconds}`;
    if (!dedupe.has(key)) {
      dedupe.add(key);
      output.push({ label, seconds });
    }
  }

  return output;
}

export function formatCountdown(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [
    hrs.toString().padStart(2, "0"),
    mins.toString().padStart(2, "0"),
    secs.toString().padStart(2, "0")
  ].join(":");
}

function buildIngredientKeywords(ingredient: string): string[] {
  return cleanText(ingredient)
    .split(" ")
    .filter((token) => token.length > 2)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !UNIT_WORDS.has(token))
    .filter((token) => !/^\d/.test(token));
}

export function getHighlightedIngredientIndexes(
  ingredients: string[],
  stepText: string
): Set<number> {
  const stepTokens = new Set(
    cleanText(stepText)
      .split(" ")
      .filter((token) => token.length > 2)
  );

  const output = new Set<number>();

  ingredients.forEach((ingredient, index) => {
    const keywords = buildIngredientKeywords(ingredient);
    if (!keywords.length) {
      return;
    }

    const matchCount = keywords.filter((token) => stepTokens.has(token)).length;
    const requiredMatches = Math.min(2, keywords.length);
    if (matchCount >= requiredMatches) {
      output.add(index);
    }
  });

  return output;
}

export function extractPrepTasks(steps: string[]): string[] {
  const dedupe = new Set<string>();
  const output: string[] = [];

  for (const step of steps) {
    const normalized = step.trim();
    if (!normalized) {
      continue;
    }

    const isPrepTask = PREP_PATTERNS.some((pattern) => pattern.test(normalized));
    if (!isPrepTask) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!dedupe.has(key)) {
      dedupe.add(key);
      output.push(normalized);
    }

    if (output.length >= 12) {
      break;
    }
  }

  if (!output.length) {
    return steps.slice(0, 6);
  }

  return output;
}
