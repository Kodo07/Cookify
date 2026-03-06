"use client";

import { useState } from "react";

import { clearClientDemoData } from "@/lib/client-reset";

interface ResetResponse {
  ok?: boolean;
  error?: string;
}

export default function DevResetPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runReset() {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const clientReset = clearClientDemoData();

      const response = await fetch("/api/dev/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store"
      });

      const payload = (await response.json()) as ResetResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Server reset failed.");
      }

      setResult(
        `Reset complete. Removed ${clientReset.localStorageRemoved.length} local keys and cleared server demo recipes.`
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Reset failed. Try again."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="card p-6">
          <h1 className="text-3xl text-ink">Reset Tester Data</h1>
          <p className="mt-2 text-sm text-slate-600">
            Dev-only utility. Clears localStorage/sessionStorage demo data and server
            saved recipe JSON store.
          </p>

          <button
            type="button"
            onClick={runReset}
            disabled={running}
            className="mt-5 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Resetting..." : "Reset all demo data"}
          </button>

          {result ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {result}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
