import { createClient, type RedisClientType } from "redis";
import { env } from "@repo/config";
import { PER_IP_LIMIT, PER_ZAP_LIMIT, RATE_WINDOW_SECONDS } from "./verify";

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: env.REDIS_URL || "redis://localhost:6379" }) as RedisClientType;
    client.on("error", () => undefined);
  }
  if (!client.isOpen) await client.connect();
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.quit();
  client = null;
}

export async function redisHealthy(): Promise<boolean> {
  try {
    const connection = await getRedis();
    return (await connection.ping()) === "PONG";
  } catch {
    return false;
  }
}

export interface RateDecision {
  allowed: boolean;
  scope: "ip" | "zap";
  limit: number;
  remaining: number;
}

async function hit(key: string, limit: number): Promise<RateDecision> {
  const redis = await getRedis();
  const redisKey = `hook:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, RATE_WINDOW_SECONDS);
  return {
    allowed: count <= limit,
    scope: key.startsWith("zap:") ? "zap" : "ip",
    limit,
    remaining: Math.max(0, limit - count),
  };
}

export function checkIpLimit(ip: string): Promise<RateDecision> {
  return hit(`ip:${ip}`, PER_IP_LIMIT);
}

export function checkZapLimit(zapId: string): Promise<RateDecision> {
  return hit(`zap:${zapId}`, PER_ZAP_LIMIT);
}
