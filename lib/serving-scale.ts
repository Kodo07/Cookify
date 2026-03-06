const FRACTION_MAP: Record<string, number> = {
  "1/8": 0.125,
  "1/4": 0.25,
  "1/3": 0.3333,
  "1/2": 0.5,
  "2/3": 0.6667,
  "3/4": 0.75
};

const COMMON_FRACTIONS = Object.entries(FRACTION_MAP);

function parseTokenQuantity(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }

  if (/^\d+\/\d+$/.test(trimmed)) {
    const [num, den] = trimmed.split("/");
    const denominator = Number.parseFloat(den ?? "0");
    if (!denominator) {
      return null;
    }
    return Number.parseFloat(num ?? "0") / denominator;
  }

  if (/^\d+\s+\d+\/\d+$/.test(trimmed)) {
    const [whole, fraction] = trimmed.split(/\s+/);
    const fractionValue = parseTokenQuantity(fraction ?? "");
    if (fractionValue === null) {
      return null;
    }
    return Number.parseFloat(whole ?? "0") + fractionValue;
  }

  return null;
}

function formatQuantity(value: number): string {
  const rounded = Math.max(0, Math.round(value * 100) / 100);
  const whole = Math.floor(rounded);
  const fractionPart = rounded - whole;

  let bestFraction = "";
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const [fractionLabel, fractionValue] of COMMON_FRACTIONS) {
    const delta = Math.abs(fractionValue - fractionPart);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestFraction = fractionLabel;
    }
  }

  if (bestDelta < 0.04 && bestFraction) {
    if (!whole) {
      return bestFraction;
    }
    return `${whole} ${bestFraction}`;
  }

  return rounded.toString().replace(/\.0+$/, "");
}

export function parseServingsCount(servings?: string): number | null {
  if (!servings) {
    return null;
  }
  const match = servings.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[1] ?? "0");
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function scaleIngredientLine(line: string, ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return line;
  }

  const pattern =
    /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?:\s*-\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?))?(\b.*)$/i;
  const match = line.match(pattern);

  if (!match) {
    return line;
  }

  const startValue = parseTokenQuantity(match[1] ?? "");
  if (startValue === null) {
    return line;
  }

  const endValue = match[2] ? parseTokenQuantity(match[2]) : null;
  const rest = match[3] ?? "";

  const scaledStart = formatQuantity(startValue * ratio);
  if (endValue !== null) {
    const scaledEnd = formatQuantity(endValue * ratio);
    return `${scaledStart}-${scaledEnd}${rest}`;
  }

  return `${scaledStart}${rest}`;
}

export function scaleIngredients(ingredients: string[], ratio: number): string[] {
  return ingredients.map((ingredient) => scaleIngredientLine(ingredient, ratio));
}
