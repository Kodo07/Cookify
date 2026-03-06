"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { playTimerDoneTone } from "@/lib/sound";
import type { TimerMatch } from "@/lib/step-tools";

export interface ActiveTimer extends TimerMatch {
  id: string;
  total: number;
  remaining: number;
  running: boolean;
}

export interface TimerToast {
  id: string;
  message: string;
}

export function useCookingTimers() {
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [toasts, setToasts] = useState<TimerToast[]>([]);
  const previousRemaining = useRef<Record<string, number>>({});

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimers((previous) =>
        previous.map((timer) => {
          if (!timer.running || timer.remaining <= 0) {
            return timer;
          }

          const nextRemaining = Math.max(0, timer.remaining - 1);
          return {
            ...timer,
            remaining: nextRemaining,
            running: nextRemaining > 0
          };
        })
      );
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const finishedTimers = timers.filter((timer) => {
      const prevValue = previousRemaining.current[timer.id] ?? timer.total;
      return prevValue > 0 && timer.remaining === 0;
    });

    if (finishedTimers.length) {
      playTimerDoneTone();
      setToasts((previous) => [
        ...finishedTimers.map((timer) => ({
          id: `${timer.id}-${Date.now().toString(36)}`,
          message: `${timer.label} timer finished`
        })),
        ...previous
      ]);
    }

    const nextSnapshot: Record<string, number> = {};
    for (const timer of timers) {
      nextSnapshot[timer.id] = timer.remaining;
    }
    previousRemaining.current = nextSnapshot;
  }, [timers]);

  useEffect(() => {
    if (!toasts.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToasts((previous) => previous.slice(0, Math.max(previous.length - 1, 0)));
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [toasts]);

  const startTimer = useCallback((match: TimerMatch) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;

    setTimers((previous) => [
      {
        id,
        label: match.label,
        seconds: match.seconds,
        total: match.seconds,
        remaining: match.seconds,
        running: true
      },
      ...previous
    ]);
  }, []);

  const toggleTimer = useCallback((id: string) => {
    setTimers((previous) =>
      previous.map((timer) =>
        timer.id === id
          ? { ...timer, running: timer.remaining > 0 && !timer.running }
          : timer
      )
    );
  }, []);

  const resetTimer = useCallback((id: string) => {
    setTimers((previous) =>
      previous.map((timer) =>
        timer.id === id
          ? { ...timer, remaining: timer.total, running: false }
          : timer
      )
    );
  }, []);

  const removeTimer = useCallback((id: string) => {
    setTimers((previous) => previous.filter((timer) => timer.id !== id));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  return {
    timers,
    toasts,
    startTimer,
    toggleTimer,
    resetTimer,
    removeTimer,
    dismissToast
  };
}
