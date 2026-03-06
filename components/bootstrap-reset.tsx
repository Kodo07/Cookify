"use client";

import { useEffect } from "react";

import { clearClientDemoData } from "@/lib/client-reset";

const RESET_VERSION_KEY = "recipecards:bootstrap-reset-version";
const RESET_VERSION = "tester-reset-v1";

export function BootstrapReset() {
  useEffect(() => {
    try {
      const currentVersion = localStorage.getItem(RESET_VERSION_KEY);
      if (currentVersion === RESET_VERSION) {
        return;
      }

      clearClientDemoData();
      localStorage.setItem(RESET_VERSION_KEY, RESET_VERSION);
    } catch {
      // ignore bootstrap reset failures
    }
  }, []);

  return null;
}
