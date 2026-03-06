import type { DetailLevel } from "@/lib/types";

interface HowToStepLike {
  text?: unknown;
  name?: unknown;
  itemListElement?: unknown;
  recipeInstructions?: unknown;
  steps?: unknown;
  instructions?: unknown;
}

export type StepInput = string | HowToStepLike;

interface NormalizeOptions {
  mode: DetailLevel;
}

const HARD_CAP = 30;
const SIMPLE_TARGET = 16;
const DETAILED_TARGET = 22;
const SIMPLE_CAP = 22;
const DETAILED_CAP = 25;
const MIN_STEP_LENGTH = 35;
const SIMPLE_MAX_STEP_LENGTH = 140;
const DETAILED_MAX_STEP_LENGTH = 160;

const ACTION_KEYWORDS = [
  "add",
  "arrange",
  "bake",
  "beat",
  "blend",
  "boil",
  "bring",
  "broil",
  "chill",
  "chop",
  "combine",
  "cook",
  "cover",
  "drain",
  "fold",
  "fry",
  "garnish",
  "grate",
  "grill",
  "heat",
  "layer",
  "knead",
  "let",
  "marinate",
  "measure",
  "mix",
  "pour",
  "preheat",
  "reduce",
  "remove",
  "rest",
  "roast",
  "saute",
  "season",
  "serve",
  "simmer",
  "slice",
  "sprinkle",
  "stir",
  "toast",
  "transfer",
  "turn",
  "whip",
  "whisk"
];

const FLUFF_PATTERNS = [
  /^\s*(?:chef'?s?\s*)?tips?\b/i,
  /^\s*notes?\b/i,
  /\boptional(?:ly)?\b/i,
  /\bdon'?t worry\b/i,
  /\byou can\b/i,
  /\byou(?:'ll| will)\b/i,
  /\bfor best results\b/i,
  /\bat this point\b/i,
  /\bif you like\b/i,
  /\bfeel free\b/i,
  /\bmake ahead\b/i,
  /\bstorage\b/i,
  /\bleftovers?\b/i
];

function cleanWhitespace(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/\[(?:step|instruction|directions?|method|section)\]/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPrefixes(input: string): string {
  return input
    .replace(/^\s*\[(?:step|instruction|directions?)\]\s*/i, "")
    .replace(/^\s*step\s*\d+\s*[:.)-]?\s*/i, "")
    .replace(/^\s*step\s*[:.)-]?\s*/i, "")
    .replace(/^\s*\d+\s*[:.)-]\s*/, "")
    .replace(/^\s*[-*]\s*/, "")
    .trim();
}

function normalizeSentenceCase(input: string): string {
  const trimmed = stripPrefixes(cleanWhitespace(input))
    .replace(/^[,\s]+/, "")
    .replace(/[;:]+$/, "")
    .trim();
  if (!trimmed) {
    return "";
  }

  if (/^(step|instruction)\b/i.test(trimmed)) {
    return "";
  }

  return trimmed[0]!.toUpperCase() + trimmed.slice(1);
}

function splitRawInstruction(rawLine: string): string[] {
  const line = cleanWhitespace(rawLine);
  if (!line) {
    return [];
  }

  return line
    .split(/\r?\n|[\u2022\u25CF\u25AA]/g)
    .flatMap((part) => part.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .flatMap((part) => part.split(/\s*;\s*/g))
    .map((part) => normalizeSentenceCase(part))
    .filter(Boolean);
}

function isFluff(step: string): boolean {
  if (!step || step.length < 5) {
    return true;
  }
  if (/^https?:\/\//i.test(step)) {
    return true;
  }
  return FLUFF_PATTERNS.some((pattern) => pattern.test(step));
}

function isActionable(step: string): boolean {
  const lower = step.toLowerCase();

  if (ACTION_KEYWORDS.some((verb) => new RegExp(`\\b${verb}\\b`, "i").test(lower))) {
    return true;
  }

  if (/^(?:once|when|while|after)\b.+\b(?:add|mix|cook|stir|bake|boil|simmer)\b/i.test(step)) {
    return true;
  }

  if (/\b\d+(?:\.\d+)?\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/i.test(step)) {
    return true;
  }

  if (/\b\d+\s*(f|c)\b/i.test(lower)) {
    return true;
  }

  if (/\b(preheat|oven|heat|pan|pot|skillet|bowl|sheet)\b/i.test(lower)) {
    return true;
  }

  return false;
}

function forceBreakByLength(step: string, maxLength: number): string[] {
  if (step.length <= maxLength) {
    return [step];
  }

  const words = step.split(/\s+/);
  const output: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      output.push(normalizeSentenceCase(current));
    }
    current = word;
  }

  if (current) {
    output.push(normalizeSentenceCase(current));
  }

  return output.filter(Boolean);
}

function splitLongStep(step: string, mode: DetailLevel): string[] {
  const maxLength =
    mode === "simple" ? SIMPLE_MAX_STEP_LENGTH : DETAILED_MAX_STEP_LENGTH;
  if (step.length <= maxLength) {
    return [step];
  }

  const splitRegex =
    mode === "simple"
      ? /(?:\s+then\s+|\s+and\s+|\s+until\s+|\s+after\s+|,\s+|:\s+)/i
      : /(?:\s+then\s+|\s+after\s+|\s+until\s+|,\s+)/i;

  const chunks = step
    .split(splitRegex)
    .map((part) => normalizeSentenceCase(part))
    .filter(Boolean);

  if (chunks.length <= 1) {
    return forceBreakByLength(step, maxLength);
  }

  const output: string[] = [];
  let current = "";

  for (const chunk of chunks) {
    const next = current
      ? `${current.replace(/[.,;:]$/, "")}, ${chunk}`
      : chunk;

    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      output.push(normalizeSentenceCase(current));
    }

    if (chunk.length > maxLength && chunk.includes(",")) {
      output.push(...forceBreakByLength(chunk, maxLength));
      current = "";
      continue;
    }

    current = chunk;
  }

  if (current) {
    output.push(normalizeSentenceCase(current));
  }

  return output.flatMap((chunk) => forceBreakByLength(chunk, maxLength));
}

function dedupeSteps(steps: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const step of steps) {
    const normalized = normalizeSentenceCase(step);
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

function mergeSteps(left: string, right: string): string {
  const leftTrimmed = left.replace(/[.,;:]$/, "").trim();
  const rightTrimmed = right.trim();
  return normalizeSentenceCase(`${leftTrimmed}, ${rightTrimmed}`);
}

function mergeTinySteps(steps: string[]): string[] {
  const output: string[] = [];

  for (let index = 0; index < steps.length; index += 1) {
    const current = steps[index] ?? "";

    if (current.length < MIN_STEP_LENGTH && index < steps.length - 1) {
      output.push(mergeSteps(current, steps[index + 1] ?? ""));
      index += 1;
      continue;
    }

    output.push(current);
  }

  return output;
}

function mergeNearestSteps(steps: string[], cap: number): string[] {
  const output = [...steps];

  while (output.length > cap && output.length > 1) {
    let bestIndex = 0;
    let bestLength = Number.POSITIVE_INFINITY;

    for (let index = 0; index < output.length - 1; index += 1) {
      const length = output[index]!.length + output[index + 1]!.length;
      if (length < bestLength) {
        bestLength = length;
        bestIndex = index;
      }
    }

    output.splice(
      bestIndex,
      2,
      mergeSteps(output[bestIndex] ?? "", output[bestIndex + 1] ?? "")
    );
  }

  return output;
}

function collectInstructionText(input: unknown, bucket: string[]): void {
  if (!input) {
    return;
  }

  if (typeof input === "string") {
    const normalized = normalizeSentenceCase(input);
    if (normalized) {
      bucket.push(normalized);
    }
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((value) => collectInstructionText(value, bucket));
    return;
  }

  if (typeof input === "object") {
    const record = input as Record<string, unknown>;

    if (typeof record.text === "string") {
      collectInstructionText(record.text, bucket);
    } else if (typeof record.name === "string") {
      collectInstructionText(record.name, bucket);
    }

    collectInstructionText(record.itemListElement, bucket);
    collectInstructionText(record.recipeInstructions, bucket);
    collectInstructionText(record.steps, bucket);
    collectInstructionText(record.instructions, bucket);
  }
}

function prepareRawSteps(rawSteps: StepInput[]): string[] {
  const flattened: string[] = [];
  rawSteps.forEach((entry) => collectInstructionText(entry, flattened));

  return flattened
    .flatMap((line) => splitRawInstruction(line))
    .map((line) => normalizeSentenceCase(line))
    .filter(Boolean);
}

export function normalizeSteps(
  rawSteps: StepInput[],
  options: NormalizeOptions
): string[] {
  const mode = options.mode;
  const target = mode === "simple" ? SIMPLE_TARGET : DETAILED_TARGET;
  const modeCap = mode === "simple" ? SIMPLE_CAP : DETAILED_CAP;

  const base = prepareRawSteps(rawSteps).filter((line) => !isFluff(line));
  if (!base.length) {
    return [];
  }

  let steps = base.filter((line) => isActionable(line));
  if (steps.length < Math.max(4, Math.floor(base.length * 0.4))) {
    steps = [...base];
  }

  steps = steps.flatMap((step) => splitLongStep(step, mode));
  steps = steps.filter((step) => !isFluff(step));
  steps = mergeTinySteps(steps);
  steps = dedupeSteps(steps);

  if (steps.length > 40) {
    steps = mergeNearestSteps(steps, HARD_CAP);
  }

  if (steps.length > modeCap) {
    steps = mergeNearestSteps(steps, modeCap);
  }

  if (steps.length > target && mode === "simple") {
    steps = mergeNearestSteps(steps, target);
  }

  if (steps.length > HARD_CAP) {
    steps = mergeNearestSteps(steps, HARD_CAP);
  }

  return steps.slice(0, HARD_CAP);
}

export function buildNormalizedStepVariants(rawSteps: StepInput[]): {
  rawInstructions: string[];
  stepsSimple: string[];
  stepsDetailed: string[];
} {
  const rawInstructions = prepareRawSteps(rawSteps);

  let stepsSimple = normalizeSteps(rawInstructions, { mode: "simple" });
  let stepsDetailed = normalizeSteps(rawInstructions, { mode: "detailed" });

  if (!stepsSimple.length) {
    stepsSimple = rawInstructions.slice(0, HARD_CAP);
  }

  if (!stepsDetailed.length) {
    stepsDetailed = rawInstructions.slice(0, HARD_CAP);
  }

  return {
    rawInstructions,
    stepsSimple,
    stepsDetailed
  };
}
