"use client";

interface UpgradeModalProps {
  open: boolean;
  feature: string;
  onClose: () => void;
}

export function UpgradeModal({ open, feature, onClose }: UpgradeModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-3 inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
          Pro
        </div>

        <h2 className="mb-2 text-2xl text-ink">Unlock {feature}</h2>
        <p className="mb-5 text-sm text-slate-600">
          Upgrade to Pro for pantry AI generation, smart grocery lists, meal
          planning, voice controls, and AI cooking helpers.
        </p>

        <div className="flex flex-wrap gap-2">
          <a
            href="/pricing"
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            onClick={onClose}
          >
            View Pricing
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
