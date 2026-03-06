const RECIPE_STORAGE_PREFIX = "recipecards:recipe:";

export function recipeStorageKey(id: string): string {
  return `${RECIPE_STORAGE_PREFIX}${id}`;
}

export function createRecipeId(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 45);

  return `${slug || "recipe"}-${Date.now().toString(36)}`;
}
