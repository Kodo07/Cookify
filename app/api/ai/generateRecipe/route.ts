import { NextRequest, NextResponse } from "next/server";

import { buildAiCacheKey, getCachedValue, setCachedValue } from "@/lib/ai/cache";
import { generateRecipeFromPantryWithAi, isAiConfigured } from "@/lib/ai/hf";
import { checkTokenBucket, getClientIpFromHeaders } from "@/lib/ai/rate-limit";
import { resolveProAccess } from "@/lib/pro-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RATE_CAPACITY = 8;
const RATE_REFILL_PER_SECOND = RATE_CAPACITY / (60 * 60);
const { hasProAccess: PRO_ACCESS_ENABLED } = resolveProAccess(
  process.env.NEXT_PUBLIC_PRO_ENABLED === "true"
);

interface GenerateRecipeBody {
  ingredients?: unknown;
  servings?: unknown;
  diet?: unknown;
}

interface GeneratedRecipeResponse {
  title: string;
  ingredients: string[];
  steps: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
}

function parseIngredients(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function parseServings(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return undefined;
  }

  return Math.min(24, Math.max(1, Math.round(input)));
}

function parseDiet(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const value = input.trim().toLowerCase();
  return value || undefined;
}

function response(payload: GeneratedRecipeResponse): NextResponse {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!PRO_ACCESS_ENABLED) {
      return NextResponse.json({ error: "Pro access required." }, { status: 402 });
    }

    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: "AI not configured. Set HF_TOKEN on the server." },
        { status: 503 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers);
    const rateLimit = checkTokenBucket({
      bucketKey: `generateRecipe:${ip}`,
      capacity: RATE_CAPACITY,
      refillTokensPerSecond: RATE_REFILL_PER_SECOND
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const body = (await request.json()) as GenerateRecipeBody;
    const ingredients = parseIngredients(body.ingredients);
    const servings = parseServings(body.servings);
    const diet = parseDiet(body.diet);

    if (!ingredients.length) {
      return NextResponse.json(
        { error: "Provide at least one ingredient." },
        { status: 400 }
      );
    }

    const cacheKey = buildAiCacheKey("generateRecipe", {
      ingredients,
      servings,
      diet
    });
    const cached = getCachedValue<GeneratedRecipeResponse>(cacheKey);
    if (cached?.steps?.length) {
      return response(cached);
    }

    const generated = await generateRecipeFromPantryWithAi({
      ingredients,
      servings,
      diet
    });

    if (!generated.steps.length || !generated.ingredients.length) {
      throw new Error("AI generated an empty recipe.");
    }

    setCachedValue(cacheKey, generated, CACHE_TTL_MS);
    return response(generated);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI recipe generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
