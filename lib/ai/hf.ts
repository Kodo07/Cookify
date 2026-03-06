import "server-only";

import { InferenceClient } from "@huggingface/inference";

import { normalizeSteps } from "@/lib/step-normalizer";
import { extractPrepTasks } from "@/lib/step-tools";
import type { DetailLevel } from "@/lib/types";

const HF_MODELS = [
  "Qwen/Qwen2.5-7B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.3"
];

type ModelListKey = "steps" | "tasks" | "substitutions";

const STEP_LINE_PREFIX = /^\s*(?:[-*]|\d+[.)])\s*/;
const STEP_NUMBER_PREFIX = /^\s*step\s*\d+\s*[:.)-]?\s*/i;

export function isAiConfigured(): boolean {
  return Boolean(process.env.HF_TOKEN);
}

function getInferenceClient(): InferenceClient {
  const token = process.env.HF_TOKEN;
  if (!token) {
    throw new Error("AI is not configured. Missing HF_TOKEN.");
  }
  return new InferenceClient(token);
}

function cleanItem(line: string): string {
  return line
    .replace(STEP_LINE_PREFIX, "")
    .replace(STEP_NUMBER_PREFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanShortField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim().slice(0, 80);
  return text || undefined;
}

function uniqueNonEmpty(lines: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const cleaned = cleanItem(line);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(cleaned);
    }
  }

  return output;
}

function contentToString(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          if (typeof record.text === "string") {
            return record.text;
          }
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content === null || content === undefined) {
    return "";
  }

  return String(content);
}

function parseJsonArray(raw: string, keys: string[]): string[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanItem(item));
    }

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      for (const key of keys) {
        const list = record[key];
        if (Array.isArray(list)) {
          return list
            .filter((item): item is string => typeof item === "string")
            .map((item) => cleanItem(item));
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function parseFallbackLines(raw: string): string[] {
  return raw
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => cleanItem(line))
    .filter((line) => line.length > 2);
}

function extractJsonCandidates(raw: string): string[] {
  const candidates: string[] = [raw.trim()];
  const fenceMatches = raw.match(/```(?:json)?\s*([\s\S]*?)```/gi) ?? [];

  for (const fenced of fenceMatches) {
    const inner = fenced
      .replace(/```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
    if (inner) {
      candidates.push(inner);
    }
  }

  return candidates;
}

function keyAliases(key: ModelListKey): string[] {
  if (key === "substitutions") {
    return ["substitutions", "options", "alternatives", "items", "list"];
  }

  if (key === "tasks") {
    return ["tasks", "items", "list"];
  }

  return ["steps", "instructions", "directions", "items", "list"];
}

function parseModelList(raw: string, key: ModelListKey): string[] {
  const candidates = extractJsonCandidates(raw);
  const bracketMatch = raw.match(/\[[\s\S]*\]/);
  if (bracketMatch?.[0]) {
    candidates.push(bracketMatch[0]);
  }

  for (const candidate of candidates) {
    const parsed = parseJsonArray(candidate, keyAliases(key));
    if (parsed?.length) {
      return uniqueNonEmpty(parsed);
    }
  }

  return uniqueNonEmpty(parseFallbackLines(raw));
}

function parseStringListFromUnknown(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((item): item is string => typeof item === "string")
      .map((item) => cleanItem(item));
  }

  if (typeof input === "string") {
    return parseFallbackLines(input);
  }

  return [];
}

async function requestModelOutput(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 900
): Promise<string> {
  const client = getInferenceClient();
  let lastError: unknown;

  for (const model of HF_MODELS) {
    try {
      const completion = await client.chatCompletion({
        model,
        max_tokens: maxTokens,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      });

      const content = contentToString(completion.choices?.[0]?.message?.content);
      if (content.trim()) {
        return content;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI response generation failed.");
}

function capStepLength(step: string): string {
  const cleaned = cleanItem(step);
  if (cleaned.length <= 160) {
    return cleaned;
  }

  return `${cleaned.slice(0, 157).trim()}...`;
}

function normalizeFlashcardStepList(
  steps: string[],
  mode: DetailLevel
): string[] {
  const normalized = normalizeSteps(steps, { mode }).slice(0, 30);
  if (normalized.length) {
    return normalized;
  }
  return uniqueNonEmpty(steps).slice(0, 30);
}

function normalizeRecipeStepList(steps: string[]): string[] {
  const cleaned = uniqueNonEmpty(steps).map((step) => capStepLength(step));
  if (!cleaned.length) {
    return [];
  }

  let normalized = normalizeSteps(cleaned, { mode: "detailed" })
    .map((step) => capStepLength(step))
    .filter(Boolean)
    .slice(0, 30);

  if (normalized.length < 8) {
    normalized = cleaned.slice(0, 30);
  }

  if (normalized.length < 12 && cleaned.length >= 12) {
    normalized = cleaned.slice(0, Math.min(25, cleaned.length));
  }

  return uniqueNonEmpty(normalized).slice(0, 30);
}

export async function generateFlashcardsWithAi(input: {
  title: string;
  ingredients: string[];
  rawSteps: string[];
  mode: DetailLevel;
}): Promise<string[]> {
  const mode = input.mode;
  const sourceSteps = uniqueNonEmpty(input.rawSteps).slice(0, 100);
  const sourceIngredients = uniqueNonEmpty(input.ingredients).slice(0, 45);
  if (!sourceSteps.length) {
    return [];
  }

  const modeInstructions =
    mode === "simple"
      ? "Use aggressive simplification for fast cooking flow."
      : "Keep a bit more technique/context while staying concise and actionable.";

  const systemPrompt =
    "You are an expert culinary instruction editor. Return ONLY valid JSON.";
  const userPrompt = [
    "Transform this recipe into flashcard-ready cooking steps.",
    modeInstructions,
    "Rules:",
    "- Return JSON array of strings only.",
    "- Keep sequence faithful to the source instructions.",
    "- Keep only actionable cooking instructions.",
    "- Preserve temperatures, cook times, and key quantities.",
    "- Remove fluff like tips/notes/optional chatter.",
    "- One action per step whenever possible.",
    "- Target 12-25 steps when possible, hard cap 30.",
    "- Max step length 160 characters.",
    "- Steps must not start with numbering or 'Step X'.",
    "",
    `Recipe title: ${input.title || "Untitled recipe"}`,
    "",
    "Ingredients:",
    ...sourceIngredients.map((ingredient) => `- ${ingredient}`),
    "",
    "Input steps:",
    ...sourceSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Output format example:",
    '["Preheat oven to 375 F.", "Whisk eggs and milk in a bowl."]'
  ].join("\n");

  const rawOutput = await requestModelOutput(systemPrompt, userPrompt, 1100);
  const parsed = parseModelList(rawOutput, "steps");
  const candidateSteps = parsed.length ? parsed : sourceSteps;
  return normalizeFlashcardStepList(candidateSteps, mode);
}

export async function simplifyStepsWithAi(input: {
  steps: string[];
  mode: DetailLevel;
}): Promise<string[]> {
  return generateFlashcardsWithAi({
    title: "",
    ingredients: [],
    rawSteps: input.steps,
    mode: input.mode
  });
}

export async function generatePrepTasksWithAi(input: {
  title: string;
  ingredients: string[];
  steps: string[];
}): Promise<string[]> {
  const steps = uniqueNonEmpty(input.steps).slice(0, 80);
  if (!steps.length) {
    return [];
  }

  const ingredients = uniqueNonEmpty(input.ingredients).slice(0, 40);

  const systemPrompt =
    "You are an expert kitchen assistant. Return ONLY valid JSON. No prose.";
  const userPrompt = [
    `Recipe title: ${input.title || "Untitled recipe"}`,
    "",
    "Generate a prep checklist to complete before active cooking begins.",
    "Rules:",
    "- Return a JSON array of short actionable tasks.",
    "- Keep each task imperative and clear.",
    "- Include prep actions like preheat, chop, mince, measure, set out tools.",
    "- Do not include serving/plating/storage tips.",
    "- Target 6-12 tasks.",
    "",
    "Ingredients:",
    ...ingredients.map((item) => `- ${item}`),
    "",
    "Steps:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Output format example:",
    '["Preheat oven to 400 F.", "Mince garlic and chop onion."]'
  ].join("\n");

  const rawOutput = await requestModelOutput(systemPrompt, userPrompt, 800);
  const parsed = parseModelList(rawOutput, "tasks").slice(0, 14);

  if (parsed.length) {
    return parsed;
  }

  const fallback = extractPrepTasks(normalizeSteps(steps, { mode: "detailed" }));
  return fallback.slice(0, 12);
}

function parseRecipePayloadFromObject(raw: unknown): {
  title: string;
  ingredients: string[];
  steps: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
} | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const nested =
    record.recipe && typeof record.recipe === "object"
      ? (record.recipe as Record<string, unknown>)
      : record;

  const title = cleanShortField(nested.title) ?? "Pantry Recipe";
  const ingredients = parseStringListFromUnknown(
    nested.ingredients ?? nested.ingredientList ?? nested.items
  );
  const steps = parseStringListFromUnknown(
    nested.steps ?? nested.instructions ?? nested.directions ?? nested.method
  );

  if (!ingredients.length || !steps.length) {
    return null;
  }

  return {
    title,
    ingredients: uniqueNonEmpty(ingredients).slice(0, 80),
    steps: normalizeRecipeStepList(steps),
    prepTime: cleanShortField(nested.prepTime),
    cookTime: cleanShortField(nested.cookTime),
    servings: cleanShortField(nested.servings)
  };
}

function parseRecipePayloadFromLines(raw: string): {
  title: string;
  ingredients: string[];
  steps: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
} | null {
  const lines = raw
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  let title = "Pantry Recipe";
  const ingredients: string[] = [];
  const steps: string[] = [];
  let section: "none" | "ingredients" | "steps" = "none";
  let prepTime: string | undefined;
  let cookTime: string | undefined;
  let servings: string | undefined;

  for (const line of lines) {
    if (/^title\s*[:\-]/i.test(line)) {
      title = cleanItem(line.replace(/^title\s*[:\-]/i, "")) || title;
      continue;
    }

    if (/^prep\s*time\s*[:\-]/i.test(line)) {
      prepTime = cleanShortField(line.replace(/^prep\s*time\s*[:\-]/i, ""));
      continue;
    }

    if (/^cook\s*time\s*[:\-]/i.test(line)) {
      cookTime = cleanShortField(line.replace(/^cook\s*time\s*[:\-]/i, ""));
      continue;
    }

    if (/^servings?\s*[:\-]/i.test(line)) {
      servings = cleanShortField(line.replace(/^servings?\s*[:\-]/i, ""));
      continue;
    }

    if (/^ingredients?\b[:\-]?$/i.test(line)) {
      section = "ingredients";
      continue;
    }

    if (/^(steps?|instructions?|directions?|method)\b[:\-]?$/i.test(line)) {
      section = "steps";
      continue;
    }

    if (section === "ingredients") {
      const item = cleanItem(line);
      if (item) {
        ingredients.push(item);
      }
      continue;
    }

    if (section === "steps") {
      const step = cleanItem(line);
      if (step) {
        steps.push(step);
      }
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      steps.push(cleanItem(line));
    }
  }

  if (!steps.length) {
    steps.push(...parseFallbackLines(raw));
  }

  if (!ingredients.length && lines.length > 4) {
    for (const line of lines) {
      if (/^-/.test(line) || /,/.test(line)) {
        const item = cleanItem(line);
        if (item.length > 2 && !/minute|hour|oven|cook/i.test(item)) {
          ingredients.push(item);
        }
      }
      if (ingredients.length >= 20) {
        break;
      }
    }
  }

  const normalizedSteps = normalizeRecipeStepList(steps);
  if (!ingredients.length || !normalizedSteps.length) {
    return null;
  }

  return {
    title,
    ingredients: uniqueNonEmpty(ingredients).slice(0, 80),
    steps: normalizedSteps,
    prepTime,
    cookTime,
    servings
  };
}

export async function generateRecipeFromPantryWithAi(input: {
  ingredients: string[];
  servings?: number;
  diet?: string;
}): Promise<{
  title: string;
  ingredients: string[];
  steps: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
}> {
  const ingredients = uniqueNonEmpty(input.ingredients).slice(0, 40);
  if (!ingredients.length) {
    throw new Error("Provide at least one ingredient.");
  }

  const requestedServings =
    typeof input.servings === "number" && Number.isFinite(input.servings)
      ? Math.min(24, Math.max(1, Math.round(input.servings)))
      : 2;
  const diet =
    typeof input.diet === "string" && input.diet.trim() && input.diet !== "none"
      ? input.diet.trim()
      : "none";

  const systemPrompt =
    "You are an expert chef and recipe writer. Return ONLY strict JSON.";
  const userPrompt = [
    "Create a realistic recipe from pantry ingredients.",
    "Rules:",
    "- Return a JSON object only.",
    '- JSON shape: {"title":string,"ingredients":string[],"steps":string[],"prepTime"?:string,"cookTime"?:string,"servings"?:string}.',
    "- Use most provided ingredients naturally.",
    "- Keep the recipe coherent and executable.",
    "- Steps must be flashcard-friendly:",
    "  - target 12-25 steps when possible, hard cap 30",
    "  - one action per step",
    "  - max 160 chars per step",
    "  - preserve temperatures and cook times",
    "- Respect diet preference when possible.",
    "",
    `Requested servings: ${requestedServings}`,
    `Diet preference: ${diet}`,
    "Available ingredients:",
    ...ingredients.map((item) => `- ${item}`),
    "",
    "No markdown, no prose, JSON only."
  ].join("\n");

  const rawOutput = await requestModelOutput(systemPrompt, userPrompt, 1300);
  const candidates = extractJsonCandidates(rawOutput);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const recipe = parseRecipePayloadFromObject(parsed);
      if (recipe?.steps.length) {
        return {
          ...recipe,
          servings: recipe.servings ?? `${requestedServings} servings`
        };
      }
    } catch {
      continue;
    }
  }

  const fallback = parseRecipePayloadFromLines(rawOutput);
  if (fallback) {
    return {
      ...fallback,
      servings: fallback.servings ?? `${requestedServings} servings`
    };
  }

  throw new Error("AI recipe generation returned an unusable result.");
}

export async function generateIngredientSubstitutionsWithAi(input: {
  ingredient: string;
  diet?: string;
  allergies?: string[];
}): Promise<string[]> {
  const ingredient = cleanItem(input.ingredient);
  if (!ingredient) {
    return [];
  }

  const allergies = uniqueNonEmpty(input.allergies ?? []).slice(0, 10);
  const diet =
    typeof input.diet === "string" && input.diet.trim() && input.diet !== "none"
      ? input.diet.trim()
      : "none";

  const systemPrompt =
    "You are a practical cooking assistant. Return ONLY strict JSON.";
  const userPrompt = [
    "Generate practical ingredient substitutions.",
    "Rules:",
    "- Return JSON array of strings only.",
    "- Provide 4-8 substitutions.",
    "- Keep each substitution short and specific.",
    "- Prefer common grocery-store options.",
    "- Respect requested diet and allergies.",
    "",
    `Ingredient: ${ingredient}`,
    `Diet: ${diet}`,
    `Allergies: ${allergies.length ? allergies.join(", ") : "none"}`,
    "",
    'Output example: ["Greek yogurt", "Coconut yogurt", "Silken tofu blend"]',
    "No markdown, no prose."
  ].join("\n");

  const rawOutput = await requestModelOutput(systemPrompt, userPrompt, 450);
  const parsed = parseModelList(rawOutput, "substitutions")
    .map((item) => capStepLength(item))
    .slice(0, 8);

  return uniqueNonEmpty(parsed).slice(0, 8);
}

