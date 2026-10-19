import type { NextFunction, Request, Response } from "express";
import { getRedis } from "../lib/redis";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  key: (req: Request) => string;
  message?: string;
}

export interface Counter {
  increment(key: string, ttlSeconds: number): Promise<number>;
  reset(): void;
}

export function createMemoryCounter(): Counter {
  const buckets = new Map<string, { count: number; expiresAt: number }>();
  return {
    async increment(key, ttlSeconds) {
      const now = Date.now();
      const existing = buckets.get(key);
      if (!existing || existing.expiresAt <= now) {
        buckets.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
        return 1;
      }
      existing.count += 1;
      return existing.count;
    },
    reset() {
      buckets.clear();
    },
  };
}

let sharedCounter: Counter | null = null;

async function counter(): Promise<Counter> {
  if (sharedCounter) return sharedCounter;
  const redis = await getRedis();
  const redisCounter: Counter = {
    async increment(key, ttlSeconds) {
      const redisKey = `rl:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, ttlSeconds);
      }
      return count;
    },
    async reset() {
      const keys = await redis.keys("rl:*");
      if (keys.length > 0) {
        await redis.del(keys);
      }
    },
  };
  sharedCounter = redisCounter;
  return redisCounter;
}

export function setRateLimitCounter(next: Counter | null): void {
  sharedCounter = next;
}

export function rateLimit(options: RateLimitOptions) {
  const message = options.message ?? "too many requests";
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const store = await counter();
      const count = await store.increment(options.key(req), options.windowSeconds);
      res.setHeader("X-RateLimit-Limit", String(options.limit));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.limit - count)));
      if (count > options.limit) {
        res.setHeader("Retry-After", String(options.windowSeconds));
        res.status(429).json({ error: message });
        return;
      }
      next();
    } catch {
      next();
    }
  };
}

export function byIp(req: Request): string {
  return `ip:${req.ip ?? "unknown"}`;
}

export function byUser(userId: string): string {
  return `user:${userId}`;
}
