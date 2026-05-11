interface RateLimiterConfig {
  max: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(config: RateLimiterConfig): (key: string) => boolean {
  const buckets = new Map<string, Bucket>();

  return (key: string) => {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now >= current.resetAt) {
      buckets.set(key, {
        count: 1,
        resetAt: now + config.windowMs,
      });
      return true;
    }

    if (current.count >= config.max) {
      return false;
    }

    current.count += 1;
    return true;
  };
}
