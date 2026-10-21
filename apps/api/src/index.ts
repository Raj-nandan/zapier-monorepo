import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "@repo/config";
import { logger } from "@repo/logger";
import { prisma } from "@repo/db";
import { requestId } from "./middleware/requestId";
import { redisHealthy } from "./lib/redis";
import { userRouter } from "./routes/user";
import { testTriggerRouter, zapRouter } from "./routes/zap";
import { actionRouter, triggerRouter } from "./routes/catalog";
import { folderRouter } from "./routes/folder";
import { runsRouter } from "./routes/runs";
import { dashboardRouter } from "./routes/dashboard";
import { authRouter } from "./routes/auth";
import { connectionsRouter } from "./routes/connections";
import { csrfRouter } from "./routes/csrf";
import { csrfProtect } from "./lib/csrf";

export const API_PORT = 3001;
export const MAX_BODY_BYTES = "1mb";

export function corsOrigin(): string {
  return env.WEB_URL || "http://localhost:3000";
}

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin());
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id, If-Match");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(requestId());
  app.use(cookieParser());
  app.use(express.json({ limit: MAX_BODY_BYTES }));
  app.use(csrfProtect(env.JWT_PASSWORD));

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1/user", userRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/zap", zapRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/zap/test-trigger", testTriggerRouter());
  app.use("/api/v1/trigger", triggerRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/action", actionRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/folder", folderRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/auth", authRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/csrf", csrfRouter({ secret: env.JWT_PASSWORD }));  app.use("/api/v1/connections", connectionsRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1", runsRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/dashboard", dashboardRouter({ secret: env.JWT_PASSWORD }));
  app.use("/api/v1/analytics", dashboardRouter({ secret: env.JWT_PASSWORD }));

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

  app.use((req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const candidate = error as Error & { status?: number; statusCode?: number; type?: string };
    const status = candidate.status ?? candidate.statusCode ?? 500;
    const message =
      status === 400 ? "invalid request"
      : status === 413 ? "payload too large"
      : "internal server error";
    if (status >= 500) {
      logger.child({ requestId: req.requestId, traceId: req.traceId }).error({ err: error.message }, "unhandled error");
    }
    res.status(status).json({ error: message });
  });

  return app;
}

if (import.meta.main) {
  const app = createApp();
  app.listen(API_PORT, () => {
    logger.info({ port: API_PORT }, "api listening");
  });
}
