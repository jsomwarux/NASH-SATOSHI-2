import { Redis } from "@upstash/redis";

// Upstash Redis client - serverless Redis with free tier
// Free tier: 10,000 commands/day, 256MB storage
let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log("Upstash Redis not configured - caching disabled");
    return null;
  }

  try {
    redis = new Redis({
      url,
      token,
    });
    console.log("Upstash Redis client initialized");
    return redis;
  } catch (error) {
    console.error("Failed to initialize Upstash Redis:", error);
    return null;
  }
}

// Cache keys
export const CACHE_KEYS = {
  LEADERBOARD: "leaderboard",
  ANALYSIS: (id: number) => `analysis:${id}`,
  ANALYSIS_STATUS: (id: number) => `analysis:status:${id}`,
  USER_ANALYSES: (userId: string) => `user:analyses:${userId}`,
  RATE_LIMIT: (key: string) => `ratelimit:${key}`,
  GUMLOOP_LAST_REQUEST: "gumloop:last_request",
} as const;

// Cache TTLs in seconds
export const CACHE_TTL = {
  LEADERBOARD: 60, // 1 minute
  ANALYSIS: 300, // 5 minutes
  ANALYSIS_STATUS: 10, // 10 seconds (for polling reduction)
  USER_ANALYSES: 60, // 1 minute
  RATE_LIMIT: 60, // 1 minute window
} as const;

// Helper: Get cached value or fetch from source
export async function getCachedOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const client = getRedis();

  if (!client) {
    // Redis not available, just fetch directly
    return fetchFn();
  }

  try {
    // Try to get from cache
    const cached = await client.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetchFn();

    // Cache it (fire and forget)
    client.set(key, fresh, { ex: ttlSeconds }).catch((err) => {
      console.error("Redis cache set error:", err);
    });

    return fresh;
  } catch (error) {
    console.error("Redis cache error, falling back to fetch:", error);
    return fetchFn();
  }
}

// Helper: Invalidate cache key
export async function invalidateCache(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    console.error("Redis cache invalidation error:", error);
  }
}

// Helper: Invalidate multiple cache keys by pattern
export async function invalidateCachePattern(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    // Upstash doesn't support SCAN, so we track keys manually or use specific keys
    // For now, just invalidate known keys
    if (pattern.includes("analysis")) {
      await client.del(CACHE_KEYS.LEADERBOARD);
    }
  } catch (error) {
    console.error("Redis pattern invalidation error:", error);
  }
}

// Distributed rate limiting using Redis
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const client = getRedis();

  if (!client) {
    // No Redis, allow all requests (fall back to in-memory)
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
  }

  const rateLimitKey = CACHE_KEYS.RATE_LIMIT(key);

  try {
    // Use Redis INCR with expiration for sliding window
    const current = await client.incr(rateLimitKey);

    if (current === 1) {
      // First request in window, set expiration
      await client.expire(rateLimitKey, windowSeconds);
    }

    const ttl = await client.ttl(rateLimitKey);
    const remaining = Math.max(0, maxRequests - current);

    return {
      allowed: current <= maxRequests,
      remaining,
      resetIn: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // On error, allow the request
    return { allowed: true, remaining: maxRequests, resetIn: 0 };
  }
}

// Distributed Gumloop request throttling
export async function waitForGumloopSlot(): Promise<void> {
  const client = getRedis();
  const INTERVAL_MS = 2000; // 2 seconds between requests

  if (!client) {
    // Fallback to simple delay if no Redis
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    return;
  }

  const key = CACHE_KEYS.GUMLOOP_LAST_REQUEST;

  try {
    const lastRequest = await client.get<number>(key);
    const now = Date.now();

    if (lastRequest) {
      const elapsed = now - lastRequest;
      if (elapsed < INTERVAL_MS) {
        const waitTime = INTERVAL_MS - elapsed;
        console.log(`Waiting ${waitTime}ms for Gumloop rate limit (Redis)`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Update last request time
    await client.set(key, Date.now(), { ex: 60 }); // Expire after 60s
  } catch (error) {
    console.error("Gumloop rate limit error:", error);
    // Fallback to simple delay
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

// Pub/Sub for real-time analysis completion (optional enhancement)
export async function publishAnalysisComplete(analysisId: number): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    // Set a completion flag that clients can poll (simpler than true pub/sub)
    await client.set(`analysis:complete:${analysisId}`, "1", { ex: 300 });
  } catch (error) {
    console.error("Publish analysis complete error:", error);
  }
}

export async function checkAnalysisComplete(analysisId: number): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    const complete = await client.get(`analysis:complete:${analysisId}`);
    return complete === "1";
  } catch (error) {
    return false;
  }
}
