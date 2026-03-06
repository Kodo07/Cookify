import { NextRequest, NextResponse } from "next/server";

import { buildAiCacheKey, getCachedValue, setCachedValue } from "@/lib/ai/cache";
import { generatePrepTasksWithAi } from "@/lib/ai/hf";
import { isAiConfigured } from "@/lib/ai/hf";
import { checkTokenBucket, getClientIpFromHeaders } from "@/lib/ai/rate-limit";
import { extractPrepTasks } from "@/lib/step-tools";
import { normalizeSteps } from "@/lib/step-normalizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_CAPACITY = 15;
const RATE_REFILL_PER_SECOND = RATE_CAPACITY / (60 * 60);

interface PrepTasksRequestBody {
  title?: unknown;
  ingredients?: unknown;
  steps?: unknown;
}

function parseTitle(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
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
      bucketKey: `prepTasks:${ip}`,
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

    const body = (await request.json()) as PrepTasksRequestBody;
    const title = parseTitle(body.title);
    const ingredients = parseStringArray(body.ingredients, 50);
    const steps = parseStringArray(body.steps, 120);

    if (!steps.length) {
      return NextResponse.json(
        { error: "Provide a non-empty steps array." },
        { status: 400 }
      );
    }

    const cacheKey = buildAiCacheKey("prepTasks", {
      title,
      ingredients,
      steps
    });
    const cached = getCachedValue<string[]>(cacheKey);

    if (cached?.length) {
      return NextResponse.json({ tasks: cached, cached: true });
    }

    let tasks: string[] = [];
    try {
      tasks = await generatePrepTasksWithAi({
        title,
        ingredients,
        steps
      });
    } catch {
      tasks = [];
    }

    if (!tasks.length) {
      tasks = extractPrepTasks(normalizeSteps(steps, { mode: "detailed" })).slice(
        0,
        12
      );
    }

    setCachedValue(cacheKey, tasks, CACHE_TTL_MS);

    return NextResponse.json({ tasks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI prep task generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
