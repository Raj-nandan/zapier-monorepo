import { createClient, type RedisClientType } from "redis";
import { env } from "@repo/config";

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
