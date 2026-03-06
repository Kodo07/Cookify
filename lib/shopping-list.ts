import { cleanIngredientText, normalizeIngredientTokens } from "@/lib/ingredient-normalize";

export const GROCERY_CATEGORIES = [
  "Produce",
  "Dairy",
  "Pantry",
  "Meat&Seafood",
  "Spices",
  "Other"
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export interface CategorizedShoppingList {
  Produce: string[];
  Dairy: string[];
  Pantry: string[];
  "Meat&Seafood": string[];
  Spices: string[];
  Other: string[];
}

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  Produce: "🥬 Produce",
  Dairy: "🥛 Dairy",
  Pantry: "🥫 Pantry",
  "Meat&Seafood": "🥩 Meat & Seafood",
  Spices: "🌶️ Spices",
  Other: "📦 Other"
};

export const GROCERY_EMPTY_MESSAGES: Record<GroceryCategory, string> = {
  Produce: "🥬 Produce — Nothing needed right now",
  Dairy: "🥛 Dairy — All set",
  Pantry: "🥫 Pantry — No pantry items needed",
  "Meat&Seafood": "🥩 Meat & Seafood — No proteins to buy",
  Spices: "🌶️ Spices — Spice rack is ready",
  Other: "📦 Other — Nothing extra needed"
};

const PRODUCE_KEYWORDS = new Set([
  "onion",
  "garlic",
  "tomato",
  "potato",
  "carrot",
  "pepper",
  "lettuce",
  "spinach",
  "broccoli",
  "mushroom",
  "apple",
  "banana",
  "lime",
  "lemon",
  "cilantro",
  "parsley",
  "ginger",
  "avocado",
  "zucchini",
  "cucumber"
]);

const DAIRY_KEYWORDS = new Set([
  "milk",
  "cream",
  "butter",
  "cheese",
  "yogurt",
  "parmesan",
  "mozzarella",
  "feta",
  "ricotta",
  "egg",
  "eggs"
]);

const MEAT_AND_SEAFOOD_KEYWORDS = new Set([
  "chicken",
  "beef",
  "pork",
  "bacon",
  "sausage",
  "ham",
  "turkey",
  "lamb",
  "shrimp",
  "salmon",
  "tuna",
  "cod",
  "fish",
  "anchovy"
]);

const SPICE_KEYWORDS = new Set([
  "salt",
  "pepper",
  "paprika",
  "cumin",
  "oregano",
  "basil",
  "thyme",
  "rosemary",
  "cinnamon",
  "nutmeg",
  "coriander",
  "chili",
  "turmeric",
  "seasoning"
]);

const PANTRY_KEYWORDS = new Set([
  "rice",
  "pasta",
  "flour",
  "sugar",
  "oil",
  "vinegar",
  "broth",
  "stock",
  "bean",
  "beans",
  "lentil",
  "quinoa",
  "oat",
  "breadcrumbs",
  "soy",
  "sauce",
  "ketchup",
  "mustard",
  "honey",
  "syrup"
]);

function createEmptyList(): CategorizedShoppingList {
  return {
    Produce: [],
    Dairy: [],
    Pantry: [],
    "Meat&Seafood": [],
    Spices: [],
    Other: []
  };
}

function normalizeShoppingKey(ingredient: string): string {
  const tokens = normalizeIngredientTokens(ingredient);
  if (!tokens.length) {
    return cleanIngredientText(ingredient);
  }
  return tokens.slice(0, 4).join(" ");
}

export function categorizeIngredient(ingredient: string): GroceryCategory {
  const tokens = normalizeIngredientTokens(ingredient);
  if (!tokens.length) {
    return "Other";
  }

  for (const token of tokens) {
    if (MEAT_AND_SEAFOOD_KEYWORDS.has(token)) {
      return "Meat&Seafood";
    }
    if (DAIRY_KEYWORDS.has(token)) {
      return "Dairy";
    }
    if (PRODUCE_KEYWORDS.has(token)) {
      return "Produce";
    }
    if (SPICE_KEYWORDS.has(token)) {
      return "Spices";
    }
    if (PANTRY_KEYWORDS.has(token)) {
      return "Pantry";
    }
  }

  return "Other";
}

export function buildCategorizedShoppingList(
  ingredients: string[]
): CategorizedShoppingList {
  const list = createEmptyList();
  const seen = new Set<string>();

  for (const ingredient of ingredients) {
    const line = ingredient.trim();
    if (!line) {
      continue;
    }

    const key = normalizeShoppingKey(line);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const category = categorizeIngredient(line);
    list[category].push(line);
  }

  for (const category of GROCERY_CATEGORIES) {
    list[category].sort((left, right) => left.localeCompare(right));
  }

  return list;
}

export function flattenCategorizedShoppingList(
  list: CategorizedShoppingList
): string[] {
  const lines: string[] = [];

  for (const category of GROCERY_CATEGORIES) {
    const items = list[category];
    if (!items.length) {
      continue;
    }

    lines.push(`${GROCERY_CATEGORY_LABELS[category]}`);
    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines;
}
