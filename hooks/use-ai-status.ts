"use client";

import { useCallback, useEffect, useState } from "react";

interface AiStatusResponse {
  configured?: boolean;
}

export function useAiStatus(enabled = true) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setConfigured(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/status", {
        method: "GET",
        cache: "no-store"
      });

      const payload = (await response.json()) as AiStatusResponse;
      if (!response.ok) {
        throw new Error("Could not load AI configuration state.");
      }

      setConfigured(Boolean(payload.configured));
    } catch (requestError) {
      setConfigured(false);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load AI status."
      );
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    configured,
    loading,
    error,
    refresh
  };
}
