"use client";

import { formatCountdown } from "@/lib/step-tools";
import type { ActiveTimer } from "@/hooks/use-cooking-timers";

interface TimerPanelProps {
  timers: ActiveTimer[];
  onToggle: (id: string) => void;
  onReset: (id: string) => void;
  onRemove: (id: string) => void;
  compact?: boolean;
  dark?: boolean;
  variant?: "panel" | "tray";
}

export function TimerPanel({
  timers,
  onToggle,
  onReset,
  onRemove,
  compact = false,
  dark = false,
  variant = "panel"
}: TimerPanelProps) {
  if (!timers.length) {
    return null;
  }

  if (variant === "tray") {
    return (
      <section
        className={`rounded-2xl border p-3 ${
          dark
            ? "border-slate-700 bg-slate-900 text-slate-100"
            : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em]">
            Timers
          </h3>
          <span className={`text-[11px] ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {timers.length} active
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {timers.map((timer) => (
            <div
              key={timer.id}
              className={`min-w-[220px] rounded-xl border p-3 ${
                dark
                  ? "border-slate-700 bg-slate-950 text-slate-100"
                  : "border-slate-200 bg-slate-50 text-slate-900"
              }`}
            >
              <p className={`text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>
                {timer.label}
              </p>
              <p className="mb-2 mt-0.5 text-2xl font-semibold">
                {formatCountdown(timer.remaining)}
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggle(timer.id)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                    dark
                      ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {timer.running ? "Pause" : timer.remaining === 0 ? "Done" : "Run"}
                </button>
                <button
                  type="button"
                  onClick={() => onReset(timer.id)}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                    dark
                      ? "border-slate-600 text-slate-200 hover:bg-slate-800"
                      : "border-slate-300 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(timer.id)}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                    dark
                      ? "border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                      : "border-rose-300 text-rose-600 hover:bg-rose-50"
                  }`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl border p-4 ${
        dark
          ? "border-slate-700 bg-slate-900 text-slate-100"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]">
        Active Timers
      </h3>
      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {timers.map((timer) => (
          <div
            key={timer.id}
            className={`rounded-xl border p-3 ${
              dark
                ? "border-slate-700 bg-slate-950 text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-900"
            }`}
          >
            <p className={`text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>
              {timer.label}
            </p>
            <p className="mb-3 mt-1 text-2xl font-semibold">
              {formatCountdown(timer.remaining)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onToggle(timer.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  dark
                    ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {timer.running ? "Pause" : timer.remaining === 0 ? "Done" : "Run"}
              </button>
              <button
                type="button"
                onClick={() => onReset(timer.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  dark
                    ? "border-slate-600 text-slate-200 hover:bg-slate-800"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => onRemove(timer.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  dark
                    ? "border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                    : "border-rose-300 text-rose-600 hover:bg-rose-50"
                }`}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
