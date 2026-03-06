export interface ParsedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  stepsSimple?: string[];
  stepsDetailed?: string[];
  rawInstructions?: string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: string;
  image?: string;
  source?: string;
  sourceUrl?: string;
}

export type DetailLevel = "simple" | "detailed";

export interface ParseRecipeSuccessResponse {
  recipe: ParsedRecipe;
}

export interface ErrorResponse {
  error: string;
}

export type ParseRecipeResponse = ParseRecipeSuccessResponse | ErrorResponse;
