import express, { type Express } from "express";
import helmet from "helmet";
import { prisma } from "@repo/db";
import { logger } from "@repo/logger";
import { createProducer, topics } from "@repo/kafka";
import { redisHealthy } from "./redis";
import { pollForever, type PublishMessage, type RelayPublisher } from "./relay";

export const PROCESSOR_PORT = 3003;

export function kafkaPublisher(): RelayPublisher {
  const producer = createProducer();
  let connected = false;

  async function ensure() {
    if (!connected) {
      await producer.connect();
      connected = true;
    }
  }

  return {
    async publish(message: PublishMessage) {
      await ensure();
      await producer.send({
        topic: topics.zapEvents,
        messages: [{ key: message.zapId, value: JSON.stringify(message) }],
      });
    },
    async publishDeadLetter(message: PublishMessage) {
      await ensure();
      await producer.send({
        topic: topics.zapEventsDLT,
        messages: [{ key: message.zapId, value: JSON.stringify(message) }],
      });
    },
  };
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/readyz", async (_req, res) => {
    let database = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    const redis = await redisHealthy();
    const ready = database && redis;
    res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "degraded", database, redis });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}

if (import.meta.main) {
  createApp().listen(PROCESSOR_PORT, () => {
    logger.info({ port: PROCESSOR_PORT }, "processor listening");
  });
  pollForever(kafkaPublisher()).catch((error) => {
    logger.error({ err: (error as Error).message }, "relay stopped");
  });
}
