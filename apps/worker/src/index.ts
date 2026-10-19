import express, { type Express } from "express";
import helmet from "helmet";
import { prisma } from "@repo/db";
import { logger } from "@repo/logger";
import { createConsumer, topics, decodeZapEvent } from "@repo/kafka";
import { redisHealthy } from "./redis";
import { runZapRun } from "./runner";

export const WORKER_PORT = 3004;
export const CONSUMER_GROUP = "main-worker";

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

export async function consume(): Promise<void> {
  const consumer = createConsumer(CONSUMER_GROUP);
  await consumer.connect();
  await consumer.subscribe({ topic: topics.zapEvents, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message, partition }) => {
      const payload = decodeZapEvent(message.value);
      const outcome = await runZapRun(payload.zapRunId);
      logger.child({ zapRunId: payload.zapRunId, traceId: payload.zapRunId }).info({
        status: outcome.status,
      }, "run processed");

      if (outcome.status !== "SUSPENDED") {
        await consumer.commitOffsets([
          { topic: topics.zapEvents, partition, offset: message.offset },
        ]);
      }
    },
  });
}

if (import.meta.main) {
  createApp().listen(WORKER_PORT, () => {
    logger.info({ port: WORKER_PORT }, "worker listening");
  });
  consume().catch((error) => {
    logger.error({ err: (error as Error).message }, "consumer stopped");
  });
}
