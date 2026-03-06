import { NextRequest, NextResponse } from "next/server";

import { buildAiCacheKey, getCachedValue, setCachedValue } from "@/lib/ai/cache";
import { generateFlashcardsWithAi, isAiConfigured } from "@/lib/ai/hf";
import { checkTokenBucket, getClientIpFromHeaders } from "@/lib/ai/rate-limit";
import { normalizeSteps } from "@/lib/step-normalizer";
import type { DetailLevel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_CAPACITY = 12;
const RATE_REFILL_PER_SECOND = RATE_CAPACITY / (60 * 60);

interface FlashcardsRequestBody {
  title?: unknown;
  ingredients?: unknown;
  rawSteps?: unknown;
  mode?: unknown;
}

interface FlashcardsResponsePayload {
  steps: string[];
  cached: boolean;
  aiEnhanced: boolean;
}

function parseMode(input: unknown): DetailLevel {
  return input === "detailed" ? "detailed" : "simple";
}

function parseStringArray(input: unknown, max = 120): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);
}

function parseTitle(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function buildFallbackSteps(rawSteps: string[], mode: DetailLevel): string[] {
  return normalizeSteps(rawSteps, { mode }).slice(0, 30);
}

function createResponse(payload: FlashcardsResponsePayload): NextResponse {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: "AI not configured. Set HF_TOKEN on the server." },
        { status: 503 }
      );
    }

    const ip = getClientIpFromHeaders(request.headers);
    const rateLimit = checkTokenBucket({
      bucketKey: `flashcards:${ip}`,
      capacity: RATE_CAPACITY,
      refillTokensPerSecond: RATE_REFILL_PER_SECOND
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again shortly."
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds)
          }
        }
      );
    }

    const body = (await request.json()) as FlashcardsRequestBody;
    const title = parseTitle(body.title);
    const ingredients = parseStringArray(body.ingredients, 60);
    const rawSteps = parseStringArray(body.rawSteps, 160);
    const mode = parseMode(body.mode);

    if (!rawSteps.length) {
      return NextResponse.json(
        { error: "Provide a non-empty rawSteps array." },
        { status: 400 }
      );
    }

    const cacheKey = buildAiCacheKey("flashcards", {
      title,
      ingredients,
      rawSteps,
      mode
    });

    const cached = getCachedValue<FlashcardsResponsePayload>(cacheKey);
    if (cached?.steps?.length) {
      return createResponse({
        ...cached,
        cached: true
      });
    }

    const fallbackSteps = buildFallbackSteps(rawSteps, mode);
    let aiSteps: string[] = [];

    try {
      aiSteps = await generateFlashcardsWithAi({
        title,
        ingredients,
        rawSteps,
        mode
      });
    } catch {
      aiSteps = [];
    }

    const steps = aiSteps.length ? aiSteps.slice(0, 30) : fallbackSteps;
    const payload: FlashcardsResponsePayload = {
      steps,
      cached: false,
      aiEnhanced: aiSteps.length > 0
    };

    setCachedValue(cacheKey, payload, CACHE_TTL_MS);
    return createResponse(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI flashcard generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
