# RecipeCards

RecipeCards converts recipe pages into a clean, flashcard-style cooking flow.

## Stack

- Next.js (App Router)
- TypeScript
- TailwindCSS

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Main features

- Paste recipe URLs for import.
- JSON-LD Recipe extraction with fallback HTML parsing.
- Step normalizer pipeline with `Simple` and `Detailed` detail levels.
- Ingredient checklist with per-step ingredient highlighting.
- Servings scaler with basic quantity multiplication.
- Keyboard + swipe step navigation and jump-to-step controls.
- Dedicated `/recipe/[id]/cook` fullscreen cooking interface with Wake Lock.
- Smart multi-timer system with step detection, finish tone, and toast notices.
