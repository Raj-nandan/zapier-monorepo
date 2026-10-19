import express, { type Express } from "express";
import helmet from "helmet";
import { prisma } from "@repo/db";
import { logger } from "@repo/logger";
import { redisHealthy } from "./redis";
import { pollForever } from "./jobs";

export const SCHEDULER_PORT = 3005;

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
  createApp().listen(SCHEDULER_PORT, () => {
    logger.info({ port: SCHEDULER_PORT }, "scheduler listening");
  });
  pollForever().catch((error) => {
    logger.error({ err: (error as Error).message }, "scheduler stopped");
  });
}
