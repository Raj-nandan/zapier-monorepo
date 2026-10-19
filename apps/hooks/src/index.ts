import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import { prisma } from "@repo/db";
import { logger } from "@repo/logger";
import { closeRedis, redisHealthy } from "./redis";
import {
  IDEMPOTENCY_TTL_SECONDS,
  MAX_BODY_BYTES,
  VerifyError,
  verifyIdempotencyKey,
  verifySignature,
} from "./verify";
import { checkIpLimit, checkZapLimit } from "./redis";

export const HOOKS_PORT = 3002;

export async function handleCatch(req: Request, res: Response): Promise<void> {
  const zapId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

  try {
    const zap = await prisma.zap.findUnique({
      where: { id: zapId },
      include: { webhookSecret: true, trigger: true },
    });
    if (!zap || !zap.webhookSecret || !zap.active) {
      res.status(404).json({ error: "not found" });
      return;
    }

    verifySignature({
      secret: zap.webhookSecret.secret,
      signature: req.header("x-zap-signature") ?? undefined,
      timestamp: req.header("x-zap-timestamp") ?? undefined,
      rawBody,
    });

    const idempotencyKey = verifyIdempotencyKey(req.header("x-idempotency-key") ?? undefined);

    const ipLimit = await checkIpLimit(req.ip ?? "unknown");
    if (!ipLimit.allowed) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "rate limit exceeded" });
      return;
    }
    const zapLimit = await checkZapLimit(zapId);
    if (!zapLimit.allowed) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "rate limit exceeded" });
      return;
    }

    const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
    if (existing?.zapRunId) {
      res.status(200).json({ zapRunId: existing.zapRunId, duplicate: true });
      return;
    }

    let metadata: unknown = {};
    if (rawBody.length > 0) {
      try {
        metadata = JSON.parse(rawBody);
      } catch {
        res.status(400).json({ error: "invalid json" });
        return;
      }
    }

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.zapRun.create({
        data: {
          zapId: zap.id,
          zapRevision: zap.revision,
          status: "PENDING",
          metadata: metadata as object,
        },
      });
      await tx.zapRunOutbox.create({ data: { zapRunId: created.id, zapId: zap.id } });
      await tx.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        update: { zapRunId: created.id },
        create: {
          key: idempotencyKey,
          zapId: zap.id,
          zapRunId: created.id,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000),
        },
      });
      return created;
    });

    logger.child({ zapRunId: run.id, zapId: zap.id }).info("webhook accepted");
    res.status(200).json({ zapRunId: run.id });
  } catch (error) {
    if (error instanceof VerifyError) {
      res.status(error.status).json({ error: error.reason });
      return;
    }
    throw error;
  }
}

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.raw({ type: "*/*", limit: MAX_BODY_BYTES }));

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

  app.post("/hooks/catch/:id", (req, res, next) => {
    handleCatch(req, res).catch(next);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use((error: Error, req: Request, res: Response, _next: express.NextFunction) => {
    const candidate = error as Error & { status?: number; statusCode?: number; type?: string };
    const status =
      candidate.status ?? candidate.statusCode ??
      (error.name === "PayloadTooLargeError" || candidate.type === "entity.too.large" ? 413 : 500);
    const message = status === 413 ? "payload too large" : "internal error";
    logger.child({ err: error.message }).error("hook failure");
    res.status(status).json({ error: message });
  });

  return app;
}

if (import.meta.main) {
  createApp().listen(HOOKS_PORT, () => {
    logger.info({ port: HOOKS_PORT }, "hooks listening");
  });
}

export { closeRedis };
