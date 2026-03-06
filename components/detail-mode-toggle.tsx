"use client";

import type { DetailLevel } from "@/lib/types";

interface DetailModeToggleProps {
  mode: DetailLevel;
  onChange: (mode: DetailLevel) => void;
  dark?: boolean;
}

const MODE_META: Record<DetailLevel, { label: string; hint: string }> = {
  simple: {
    label: "Simple",
    hint: "Short, cooking-friendly steps"
  },
  detailed: {
    label: "Detailed",
    hint: "More context and technique"
  }
};

export function DetailModeToggle({
  mode,
  onChange,
  dark = false
}: DetailModeToggleProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl p-1 ${
        dark ? "bg-slate-900/80" : "bg-slate-100"
      }`}
      role="group"
      aria-label="Step detail mode"
    >
      {(Object.keys(MODE_META) as DetailLevel[]).map((value) => {
        const active = mode === value;
        const palette = dark
          ? active
            ? "bg-emerald-400 text-slate-950"
            : "text-slate-300 hover:text-slate-100"
          : active
            ? "bg-white text-slate-900 shadow-soft"
            : "text-slate-600 hover:text-slate-800";

        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${palette}`}
            aria-pressed={active}
            title={MODE_META[value].hint}
          >
            {MODE_META[value].label}
          </button>
        );
      })}
    </div>
  );
}
