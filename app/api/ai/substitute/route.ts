import { NextRequest, NextResponse } from "next/server";

import { buildAiCacheKey, getCachedValue, setCachedValue } from "@/lib/ai/cache";
import { generateIngredientSubstitutionsWithAi, isAiConfigured } from "@/lib/ai/hf";
import { checkTokenBucket, getClientIpFromHeaders } from "@/lib/ai/rate-limit";
import { generateHeuristicSubstitutions } from "@/lib/substitution-heuristics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const RATE_CAPACITY = 20;
const RATE_REFILL_PER_SECOND = RATE_CAPACITY / (60 * 60);

interface SubstituteBody {
  ingredient?: unknown;
  diet?: unknown;
  allergies?: unknown;
}

function parseIngredient(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function parseDiet(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }

  const value = input.trim().toLowerCase();
  return value || undefined;
}

function parseAllergies(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SubstituteBody;
    const ingredient = parseIngredient(body.ingredient);
    const diet = parseDiet(body.diet);
    const allergies = parseAllergies(body.allergies);

    if (!ingredient) {
      return NextResponse.json(
        { error: "Provide an ingredient." },
        { status: 400 }
      );
    }

    const heuristicFallback = generateHeuristicSubstitutions({
      ingredient,
      diet,
      allergies
    });

    if (!isAiConfigured()) {
      return NextResponse.json({
        substitutions: heuristicFallback,
        fallback: true,
        reason: "ai_not_configured"
      });
    }

    const ip = getClientIpFromHeaders(request.headers);
    const rateLimit = checkTokenBucket({
      bucketKey: `substitute:${ip}`,
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

    const cacheKey = buildAiCacheKey("substitute", {
      ingredient,
      diet,
      allergies
    });
    const cached = getCachedValue<string[]>(cacheKey);
    if (cached?.length) {
      return NextResponse.json({ substitutions: cached, cached: true });
    }

    let substitutions: string[] = [];
    let fallback = false;

    try {
      substitutions = await generateIngredientSubstitutionsWithAi({
        ingredient,
        diet,
        allergies
      });
    } catch {
      substitutions = [];
    }

    if (!substitutions.length) {
      substitutions = heuristicFallback;
      fallback = true;
    }

    setCachedValue(cacheKey, substitutions, CACHE_TTL_MS);
    return NextResponse.json({ substitutions, fallback });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI substitution generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
