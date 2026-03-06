"use client";

import type { TimerToast } from "@/hooks/use-cooking-timers";

interface ToastStackProps {
  toasts: TimerToast[];
  onDismiss: (id: string) => void;
  dark?: boolean;
}

export function ToastStack({ toasts, onDismiss, dark = false }: ToastStackProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-3 py-2 text-sm shadow-soft ${
            dark
              ? "border-slate-700 bg-slate-900 text-slate-100"
              : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className={`text-xs font-semibold ${
                dark ? "text-slate-300" : "text-slate-500"
              }`}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
