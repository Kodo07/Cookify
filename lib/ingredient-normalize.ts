const COMMON_UNITS = new Set([
  "tbsp",
  "tablespoon",
  "tablespoons",
  "tsp",
  "teaspoon",
  "teaspoons",
  "cup",
  "cups",
  "gram",
  "grams",
  "g",
  "kg",
  "ml",
  "l",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "pinch",
  "dash",
  "clove",
  "cloves",
  "slice",
  "slices",
  "can",
  "cans",
  "package",
  "packages"
]);

const COMMON_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "or",
  "of",
  "the",
  "with",
  "for",
  "to",
  "taste",
  "optional",
  "divided",
  "fresh",
  "large",
  "small",
  "medium",
  "about",
  "into",
  "plus"
]);

function singularize(token: string): string {
  if (token.length <= 3) {
    return token;
  }

  if (token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("es") && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }

  return token;
}

export function parseIngredientInput(input: string): string[] {
  return input
    .split(/\r?\n|,/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function cleanIngredientText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[¼½¾]/g, " ")
    .replace(/\d+(?:[./]\d+)?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIngredientTokens(input: string): string[] {
  return cleanIngredientText(input)
    .split(" ")
    .map((token) => singularize(token.trim()))
    .filter((token) => token.length > 1)
    .filter((token) => !COMMON_UNITS.has(token))
    .filter((token) => !COMMON_STOPWORDS.has(token));
}

export function ingredientTokenSet(input: string[]): Set<string> {
  const output = new Set<string>();
  for (const ingredient of input) {
    for (const token of normalizeIngredientTokens(ingredient)) {
      output.add(token);
    }
  }
  return output;
}
