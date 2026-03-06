import { load } from "cheerio";

import { buildNormalizedStepVariants } from "@/lib/step-normalizer";
import type { ParsedRecipe } from "@/lib/types";

const USER_AGENT =
  "RecipeCardsBot/1.0 (+https://recipecards.local) Mozilla/5.0";

function cleanText(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\u00a0/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(input: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'"
  };

  return input.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => {
    return entities[entity] ?? entity;
  });
}

async function fetchHtml(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `Could not fetch recipe page (status ${response.status}).`
      );
    }

    return response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The recipe page request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


function normalizeUrl(rawUrl: string): string {
  const candidate = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Unsupported URL protocol.");
    }
    return parsed.toString();
  } catch {
    throw new Error("Please provide a valid recipe URL.");
  }
}


function extractJsonLdBlocks(html: string): unknown[] {
  const scripts: unknown[] = [];
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    const content = match[1]?.trim();
    if (!content) {
      continue;
    }

    const parsed = safeJsonParse(content);
    if (parsed !== null) {
      scripts.push(parsed);
    }
  }

  return scripts;
}

function safeJsonParse(input: string): unknown | null {
  const attempts = [
    input
      .trim()
      .replace(/<!--/g, "")
      .replace(/-->/g, "")
      .replace(/[\u0000-\u001F]/g, ""),
    decodeHtmlEntities(input.trim())
  ];

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }

  return null;
}

function hasRecipeType(record: Record<string, unknown>): boolean {
  const typeValue = record["@type"];
  if (typeof typeValue === "string") {
    return /recipe/i.test(typeValue);
  }

  if (Array.isArray(typeValue)) {
    return typeValue.some((item) => /recipe/i.test(String(item)));
  }

  return false;
}

function collectRecipeNodes(
  node: unknown,
  bucket: Array<Record<string, unknown>>
): void {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectRecipeNodes(item, bucket));
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  const record = node as Record<string, unknown>;
  if (hasRecipeType(record)) {
    bucket.push(record);
  }

  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null) {
      collectRecipeNodes(value, bucket);
    }
  }
}

function textFromUnknown(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    const text = cleanText(value);
    return text ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => textFromUnknown(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "name", "value"]) {
      if (typeof record[key] === "string") {
        return textFromUnknown(record[key]);
      }
    }
  }

  return [];
}

function normalizeIngredients(recipeNode: Record<string, unknown>): string[] {
  const source =
    recipeNode.recipeIngredient ??
    recipeNode.ingredients ??
    recipeNode.recipeIngredients;

  const seen = new Set<string>();
  const output: string[] = [];

  for (const ingredient of textFromUnknown(source)) {
    const normalized = ingredient.replace(/^\d+\.\s*/, "").trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(normalized);
    }
  }

  return output;
}

function collectRawInstructions(source: unknown, bucket: string[]): void {
  if (!source) {
    return;
  }

  if (typeof source === "string") {
    const text = cleanText(source);
    if (text) {
      bucket.push(text);
    }
    return;
  }

  if (Array.isArray(source)) {
    source.forEach((item) => collectRawInstructions(item, bucket));
    return;
  }

  if (typeof source === "object") {
    const record = source as Record<string, unknown>;
    const typeValue = Array.isArray(record["@type"])
      ? record["@type"].map((item) => String(item).toLowerCase()).join(" ")
      : String(record["@type"] ?? "").toLowerCase();
    const isHowToSection = typeValue.includes("howtosection");
    const hasStepLikeType =
      typeValue.includes("howtostep") || typeValue.includes("listitem");

    if (typeof record.text === "string") {
      const text = cleanText(record.text);
      if (text) {
        bucket.push(text);
      }
    }

    if (
      typeof record.name === "string" &&
      (!isHowToSection || !record.itemListElement) &&
      hasStepLikeType
    ) {
      const text = cleanText(record.name);
      if (text && !/^step\s*\d+$/i.test(text)) {
        bucket.push(text);
      }
    }

    if (record.itemListElement) {
      collectRawInstructions(record.itemListElement, bucket);
    }

    if (record.recipeInstructions) {
      collectRawInstructions(record.recipeInstructions, bucket);
    }

    if (record.steps) {
      collectRawInstructions(record.steps, bucket);
    }

    if (record.instructions) {
      collectRawInstructions(record.instructions, bucket);
    }
  }
}

function normalizeDuration(duration: unknown): string | undefined {
  if (!duration) {
    return undefined;
  }

  const value = Array.isArray(duration) ? duration[0] : duration;
  const text = cleanText(String(value));
  if (!text) {
    return undefined;
  }

  if (!/^P/i.test(text)) {
    return text;
  }

  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(
    text
  );

  if (!match) {
    return text;
  }

  const days = Number(match[1] ?? "0");
  const hours = Number(match[2] ?? "0");
  const minutes = Number(match[3] ?? "0");
  const seconds = Number(match[4] ?? "0");

  const totalHours = days * 24 + hours;
  const parts: string[] = [];
  if (totalHours > 0) {
    parts.push(`${totalHours} hr`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }
  if (seconds > 0 && !parts.length) {
    parts.push(`${seconds} sec`);
  }

  return parts.join(" ") || text;
}

function normalizeServings(yieldValue: unknown): string | undefined {
  if (!yieldValue) {
    return undefined;
  }

  const value = Array.isArray(yieldValue) ? yieldValue[0] : yieldValue;
  const text = cleanText(String(value));

  if (!text) {
    return undefined;
  }

  if (/\b(servings?|serves?|people)\b/i.test(text)) {
    return text;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    return `${text} servings`;
  }

  return text;
}

function firstImage(imageValue: unknown): string | undefined {
  if (!imageValue) {
    return undefined;
  }

  if (typeof imageValue === "string") {
    return imageValue;
  }

  if (Array.isArray(imageValue)) {
    for (const candidate of imageValue) {
      const image = firstImage(candidate);
      if (image) {
        return image;
      }
    }
    return undefined;
  }

  if (typeof imageValue === "object") {
    const record = imageValue as Record<string, unknown>;
    if (typeof record.url === "string") {
      return record.url;
    }
  }

  return undefined;
}

function sourceFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown source";
  }
}

function scoreRecipeNode(node: Record<string, unknown>): number {
  const ingredients = normalizeIngredients(node).length;
  const rawInstructions: string[] = [];
  collectRawInstructions(node.recipeInstructions, rawInstructions);
  const stepVariants = buildNormalizedStepVariants(rawInstructions);
  const stepScore = stepVariants.stepsSimple.length * 3;
  const titleScore = typeof node.name === "string" ? 4 : 0;
  const imageScore = node.image ? 1 : 0;

  return ingredients * 2 + stepScore + titleScore + imageScore;
}

function normalizeRecipeFromNode(
  node: Record<string, unknown>,
  sourceUrl: string
): ParsedRecipe {
  const source = sourceFromUrl(sourceUrl);
  const fallbackTitle = source
    .replace(/\.[a-z]+$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const rawInstructions: string[] = [];
  collectRawInstructions(node.recipeInstructions, rawInstructions);

  if (!rawInstructions.length && typeof node.description === "string") {
    rawInstructions.push(node.description);
  }

  const variants = buildNormalizedStepVariants(rawInstructions);

  return {
    title: cleanText(String(node.name ?? fallbackTitle)) || fallbackTitle,
    ingredients: normalizeIngredients(node),
    steps: variants.stepsSimple,
    stepsSimple: variants.stepsSimple,
    stepsDetailed: variants.stepsDetailed,
    rawInstructions: variants.rawInstructions,
    prepTime: normalizeDuration(node.prepTime),
    cookTime: normalizeDuration(node.cookTime),
    totalTime: normalizeDuration(node.totalTime),
    servings: normalizeServings(node.recipeYield),
    image: firstImage(node.image),
    source,
    sourceUrl
  };
}

function fallbackRecipeFromHtml(html: string, sourceUrl: string): ParsedRecipe {
  const $ = load(html);

  const title =
    cleanText(
      $("meta[property=\"og:title\"]").attr("content") ??
        $("meta[name=\"twitter:title\"]").attr("content") ??
        $("h1").first().text() ??
        $("title").first().text()
    ) || "Untitled Recipe";

  const ingredientSelectors = [
    '[itemprop="recipeIngredient"]',
    '[class*="ingredient"] li',
    'li[class*="ingredient"]',
    ".ingredients li"
  ];

  const instructionSelectors = [
    '[itemprop="recipeInstructions"] li',
    '[itemprop="recipeInstructions"] p',
    '[class*="instruction"] li',
    '[class*="direction"] li',
    ".instructions li",
    ".directions li",
    "ol li"
  ];

  const ingredients = collectBySelector($, ingredientSelectors, 50, 3).filter(
    (line) => line.length > 2
  );
  const rawInstructions = collectBySelector($, instructionSelectors, 120, 8);

  const variants = buildNormalizedStepVariants(rawInstructions);

  if (!ingredients.length || !variants.stepsSimple.length) {
    throw new Error("Could not identify a valid recipe on this page.");
  }

  return {
    title,
    ingredients,
    steps: variants.stepsSimple,
    stepsSimple: variants.stepsSimple,
    stepsDetailed: variants.stepsDetailed,
    rawInstructions: variants.rawInstructions,
    image:
      $("meta[property=\"og:image\"]").attr("content") ??
      $("meta[name=\"twitter:image\"]").attr("content") ??
      undefined,
    source: sourceFromUrl(sourceUrl),
    sourceUrl
  };
}

function collectBySelector(
  $: ReturnType<typeof load>,
  selectors: string[],
  maxCount: number,
  minLength: number
): string[] {
  const output: string[] = [];
  const seen = new Set<string>();

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      if (output.length >= maxCount) {
        return false;
      }

      const text = cleanText($(element).text());
      if (text.length < minLength) {
        return;
      }

      const key = text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        output.push(text);
      }
    });

    if (output.length >= maxCount) {
      break;
    }
  }

  return output;
}

export async function parseRecipeFromUrl(inputUrl: string): Promise<ParsedRecipe> {
  const sourceUrl = normalizeUrl(inputUrl);
  const html = await fetchHtml(sourceUrl);
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const recipeNodes: Array<Record<string, unknown>> = [];

  jsonLdBlocks.forEach((block) => collectRecipeNodes(block, recipeNodes));

  if (recipeNodes.length) {
    const bestNode = recipeNodes.sort(
      (a, b) => scoreRecipeNode(b) - scoreRecipeNode(a)
    )[0];
    const normalizedRecipe = normalizeRecipeFromNode(bestNode, sourceUrl);

    if (
      normalizedRecipe.title &&
      normalizedRecipe.ingredients.length &&
      (normalizedRecipe.stepsSimple?.length ?? 0) > 0
    ) {
      return normalizedRecipe;
    }
  }

  return fallbackRecipeFromHtml(html, sourceUrl);
}

