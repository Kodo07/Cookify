import { NextRequest, NextResponse } from "next/server";

import { simplifyStepsWithAi } from "@/lib/ai/hf";
import { resolveProAccess } from "@/lib/pro-access";
import type { DetailLevel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const { hasProAccess: PRO_ACCESS_ENABLED } = resolveProAccess(
  process.env.NEXT_PUBLIC_PRO_ENABLED === "true"
);

interface SimplifyStepsRequestBody {
  steps?: unknown;
  mode?: unknown;
}

function parseMode(input: unknown): DetailLevel {
  return input === "detailed" ? "detailed" : "simple";
}

function parseSteps(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 120);
}

export async function POST(request: NextRequest) {
  try {
    if (!PRO_ACCESS_ENABLED) {
      return NextResponse.json({ error: "Pro access required." }, { status: 402 });
    }

    const body = (await request.json()) as SimplifyStepsRequestBody;
    const steps = parseSteps(body.steps);
    const mode = parseMode(body.mode);

    if (!steps.length) {
      return NextResponse.json(
        { error: "Provide a non-empty steps array." },
        { status: 400 }
      );
    }

    const simplified = await simplifyStepsWithAi({ steps, mode });
    return NextResponse.json({ steps: simplified });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI step simplification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
