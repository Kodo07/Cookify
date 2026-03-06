import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "/month",
    description: "Core cooking workflow with recipe saving and guided cooking.",
    features: [
      "Recipe URL import",
      "Save recipe library",
      "Pantry ingredient workspace",
      "Deterministic flashcard steps",
      "Smart timers and prep checklist",
      "Cooking mode with keyboard/swipe controls"
    ],
    cta: "Current Plan"
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    description: "AI-enhanced workflow for faster, cleaner execution.",
    features: [
      "AI Flashcards generation",
      "AI Prep List generation",
      "AI pantry recipe generator",
      "AI ingredient substitutions",
      "Smart grocery list + copy export",
      "Calendar meal planner",
      "Voice controls in cooking mode",
      "Priority parsing and retries",
      "Future premium cooking automations"
    ],
    cta: "Upgrade to Pro"
  }
];

export default function PricingPage() {
  return (
    <main className="soft-grid min-h-screen bg-canvas bg-hero-radial px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <SiteNav className="mb-8" />
        <header className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Back
          </Link>
          <h1 className="text-4xl text-ink sm:text-5xl">Simple Pricing</h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            RecipeCards Pro unlocks pantry AI generation, substitutions, shopping
            automation, planner tools, and voice controls while preserving
            deterministic fallbacks.
          </p>
        </header>

        <section className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`card p-6 ${
                plan.name === "Pro" ? "border-slate-900/20 ring-1 ring-slate-900/10" : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-2xl text-ink">{plan.name}</h2>
                {plan.name === "Pro" ? (
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                    Pro
                  </span>
                ) : null}
              </div>

              <p className="mb-1 text-4xl font-semibold text-ink">
                {plan.price}
                <span className="ml-1 text-sm font-medium text-slate-500">
                  {plan.period}
                </span>
              </p>
              <p className="mb-5 text-sm text-slate-600">{plan.description}</p>

              <ul className="mb-6 space-y-2 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="rounded-xl bg-slate-100 px-3 py-2">
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  plan.name === "Pro"
                    ? "bg-ink text-white hover:bg-slate-800"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {plan.cta}
              </button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
