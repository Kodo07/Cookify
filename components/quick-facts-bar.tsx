interface QuickFactsBarProps {
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  servings?: string;
  compact?: boolean;
  dark?: boolean;
}

export function QuickFactsBar({
  prepTime,
  cookTime,
  totalTime,
  servings,
  compact = false,
  dark = false
}: QuickFactsBarProps) {
  const facts = [
    { label: "Prep", value: prepTime },
    { label: "Cook", value: cookTime },
    { label: "Total", value: totalTime },
    { label: "Serves", value: servings }
  ].filter((fact) => Boolean(fact.value));

  if (!facts.length) {
    return null;
  }

  const wrapperClasses = compact
    ? "flex flex-wrap gap-2"
    : "grid gap-2 sm:grid-cols-2 lg:grid-cols-4";
  const cardClasses = dark
    ? "border-slate-700 bg-slate-900/70 text-slate-100"
    : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <div className={wrapperClasses}>
      {facts.map((fact) => (
        <p
          key={fact.label}
          className={`rounded-xl border px-3 py-2 text-sm ${cardClasses}`}
        >
          <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] opacity-75">
            {fact.label}
          </span>
          <span className="font-semibold">{fact.value}</span>
        </p>
      ))}
    </div>
  );
}
