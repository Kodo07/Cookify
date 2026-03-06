import { normalizeIngredientTokens } from "@/lib/ingredient-normalize";

const HEURISTIC_MAP: Record<string, string[]> = {
  egg: [
    "1 tbsp ground flaxseed + 3 tbsp water",
    "1 tbsp chia seeds + 3 tbsp water",
    "1/4 cup unsweetened applesauce",
    "1/4 cup mashed banana"
  ],
  butter: [
    "Olive oil (3/4 amount)",
    "Vegan butter",
    "Ghee",
    "Coconut oil"
  ],
  milk: [
    "Unsweetened oat milk",
    "Unsweetened almond milk",
    "Soy milk",
    "Lactose-free milk"
  ],
  cream: ["Half-and-half", "Coconut cream", "Greek yogurt", "Evaporated milk"],
  cheese: ["Nutritional yeast", "Vegan cheese", "Feta", "Parmesan"],
  yogurt: ["Sour cream", "Greek yogurt", "Coconut yogurt", "Skyr"],
  flour: [
    "1:1 gluten-free flour blend",
    "Whole wheat flour",
    "Oat flour",
    "Almond flour"
  ],
  sugar: ["Honey", "Maple syrup", "Coconut sugar", "Brown sugar"],
  garlic: ["Garlic powder", "Shallot", "Onion powder", "Roasted garlic paste"],
  onion: ["Shallot", "Leek", "Onion powder", "Green onions"],
  soy: ["Tamari", "Coconut aminos", "Liquid aminos", "Worcestershire sauce"],
  tomato: ["Tomato paste + water", "Roasted red pepper puree", "Passata", "Canned crushed tomatoes"],
  lemon: ["Lime juice", "White wine vinegar", "Apple cider vinegar", "Citric acid pinch + water"],
  rice: ["Quinoa", "Cauliflower rice", "Farro", "Couscous"],
  pasta: ["Rice noodles", "Zucchini noodles", "Chickpea pasta", "Whole wheat pasta"],
  chicken: ["Turkey breast", "Firm tofu", "Chickpeas", "Jackfruit"],
  beef: ["Ground turkey", "Lentils", "Mushrooms + walnuts", "Plant-based mince"]
};

function stripByDiet(substitutions: string[], diet?: string): string[] {
  if (!diet || diet === "none") {
    return substitutions;
  }

  const lowered = diet.toLowerCase();
  if (lowered === "vegan") {
    return substitutions.filter(
      (item) => !/\b(ghee|parmesan|feta|greek yogurt|skyr|half-and-half|milk)\b/i.test(item)
    );
  }

  if (lowered === "dairy-free") {
    return substitutions.filter(
      (item) => !/\b(parmesan|feta|greek yogurt|skyr|half-and-half|milk|ghee)\b/i.test(item)
    );
  }

  if (lowered === "gluten-free") {
    return substitutions.filter((item) => !/\b(farro|couscous|whole wheat)\b/i.test(item));
  }

  return substitutions;
}

function stripByAllergies(substitutions: string[], allergies: string[]): string[] {
  if (!allergies.length) {
    return substitutions;
  }

  const allergyText = allergies.join(" ").toLowerCase();
  return substitutions.filter((item) => !allergyText.split(" ").some((token) => token && item.toLowerCase().includes(token)));
}

export function generateHeuristicSubstitutions(input: {
  ingredient: string;
  diet?: string;
  allergies?: string[];
}): string[] {
  const tokens = normalizeIngredientTokens(input.ingredient);
  const allergies = input.allergies?.map((item) => item.toLowerCase()) ?? [];
  const bucket = new Set<string>();

  for (const token of tokens) {
    for (const option of HEURISTIC_MAP[token] ?? []) {
      bucket.add(option);
    }
  }

  if (!bucket.size) {
    bucket.add("Use a similar ingredient with the same texture");
    bucket.add("Use a similar ingredient with the same fat level");
    bucket.add("Use a neutral flavor substitute and season to taste");
    bucket.add("Adjust liquid slightly if the substitute is drier");
  }

  const filtered = stripByAllergies(stripByDiet(Array.from(bucket), input.diet), allergies);
  return filtered.slice(0, 8);
}
