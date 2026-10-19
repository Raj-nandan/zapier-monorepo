import { createClient, type RedisClientType } from "redis";
import { env } from "@repo/config";

let client: RedisClientType | null = null;

export function redisUrl(): string {
  return env.REDIS_URL || "redis://localhost:6379";
}

export async function getRedis(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: redisUrl() }) as RedisClientType;
    client.on("error", () => undefined);
  }
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
}

export async function redisHealthy(): Promise<boolean> {
  try {
    const connection = await getRedis();
    const pong = await connection.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
