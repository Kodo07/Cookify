import "server-only";

import { createHash } from "node:crypto";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

type CacheStore = Map<string, CacheEntry<unknown>>;

declare global {
  // eslint-disable-next-line no-var
  var __recipeCardsAiCache__: CacheStore | undefined;
}

const cacheStore: CacheStore = globalThis.__recipeCardsAiCache__ ?? new Map();
globalThis.__recipeCardsAiCache__ = cacheStore;

function pruneExpiredEntries(now: number): void {
  for (const [key, entry] of cacheStore.entries()) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
}

export function buildAiCacheKey(namespace: string, payload: unknown): string {
  const serialized = JSON.stringify(payload);
  const hash = createHash("sha256").update(serialized).digest("hex");
  return `${namespace}:${hash}`;
}

export function getCachedValue<T>(key: string): T | null {
  const now = Date.now();
  pruneExpiredEntries(now);

  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCachedValue<T>(
  key: string,
  value: T,
  ttlMs: number
): void {
  const now = Date.now();
  pruneExpiredEntries(now);
  cacheStore.set(key, {
    value,
    expiresAt: now + ttlMs
  });
}
