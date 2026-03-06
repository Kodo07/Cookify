import "server-only";

interface TokenBucketEntry {
  tokens: number;
  lastRefillMs: number;
}

type TokenBucketStore = Map<string, TokenBucketEntry>;

declare global {
  // eslint-disable-next-line no-var
  var __recipeCardsAiRateLimiter__: TokenBucketStore | undefined;
}

const bucketStore: TokenBucketStore =
  globalThis.__recipeCardsAiRateLimiter__ ?? new Map();
globalThis.__recipeCardsAiRateLimiter__ = bucketStore;

interface RateLimitOptions {
  bucketKey: string;
  capacity: number;
  refillTokensPerSecond: number;
  cost?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "unknown";
}

export function checkTokenBucket(options: RateLimitOptions): RateLimitResult {
  const cost = options.cost ?? 1;
  const now = Date.now();

  const existing = bucketStore.get(options.bucketKey) ?? {
    tokens: options.capacity,
    lastRefillMs: now
  };

  const elapsedSeconds = Math.max(0, (now - existing.lastRefillMs) / 1000);
  const replenished = Math.min(
    options.capacity,
    existing.tokens + elapsedSeconds * options.refillTokensPerSecond
  );

  if (replenished < cost) {
    const deficit = cost - replenished;
    const retryAfterSeconds = Math.ceil(
      deficit / Math.max(options.refillTokensPerSecond, 0.000001)
    );

    bucketStore.set(options.bucketKey, {
      tokens: replenished,
      lastRefillMs: now
    });

    return {
      allowed: false,
      remaining: Math.floor(replenished),
      retryAfterSeconds
    };
  }

  const remaining = replenished - cost;
  bucketStore.set(options.bucketKey, {
    tokens: remaining,
    lastRefillMs: now
  });

  return {
    allowed: true,
    remaining: Math.floor(remaining),
    retryAfterSeconds: 0
  };
}
