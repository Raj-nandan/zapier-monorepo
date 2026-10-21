import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { runsQuerySchema } from "@repo/schemas";
import { currentUserId, requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { IDEMPOTENCY_TTL_SECONDS } from "../idempotency";

export const REPLAY_LIMIT = 10;
export const REPLAY_WINDOW_SECONDS = 86400;
export const DEFAULT_LIMIT = 20;

export interface RunsRouteDeps {
  secret: string;
}

function ownedRun(userId: string, runId: string) {
  return prisma.zapRun.findFirst({
    where: { id: runId, zap: { userId } },
  });
}

export function runsRouter(deps: RunsRouteDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.secret));

  router.get("/zap/:id/runs", async (req: Request, res: Response) => {    const zapId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsed = runsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const { status, cursor, limit } = parsed.data;
    const query = typeof req.query.search === "string" ? req.query.search : undefined;

    const zap = await prisma.zap.findFirst({
      where: { id: zapId, userId: currentUserId(req), ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}) },
    });
    if (!zap) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const rows = await prisma.zapRun.findMany({
      where: {
        zapId: zap.id,
        ...(status ? { status } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      runs: page.map((run) => ({
        id: run.id,
        zapId: run.zapId,
        zapRevision: run.zapRevision,
        status: run.status,
        error: run.error,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdAt: run.createdAt,
      })),
      nextCursor: hasMore ? page.at(-1)!.id : null,
      limit,
    });
  });

  router.get(["/runs", "/"], async (req: Request, res: Response) => {
    const parsed = runsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const { status, cursor, limit } = parsed.data;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const rows = await prisma.zapRun.findMany({
      where: {
        zap: {
          userId: currentUserId(req),
          ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        },
        ...(status ? { status } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      include: { zap: { select: { name: true } } },
      orderBy: { id: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      runs: page.map((run) => ({
        id: run.id,
        zapId: run.zapId,
        zapName: run.zap?.name ?? null,
        zapRevision: run.zapRevision,
        status: run.status,
        error: run.error,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        createdAt: run.createdAt,
      })),
      nextCursor: hasMore ? page.at(-1)!.id : null,
      limit,
    });
  });

  router.get("/runs/:id", async (req: Request, res: Response) => {
    const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const run = await prisma.zapRun.findFirst({
      where: { id: runId, zap: { userId: currentUserId(req) } },
      include: { zap: { select: { name: true } }, steps: { orderBy: { order: "asc" } } },
    });
    if (!run) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({
      id: run.id,
      zapId: run.zapId,
      zapName: run.zap?.name ?? null,
      zapRevision: run.zapRevision,
      status: run.status,
      metadata: run.metadata,
      error: run.error,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
      steps: run.steps.map((step) => ({
        actionId: step.actionId,
        order: step.order,
        status: step.status,
        input: step.input,
        output: step.output,
        error: step.error,
        latency: step.latency,
      })),
    });
  });
  router.post(
    "/runs/:id/replay",
    rateLimit({
      limit: REPLAY_LIMIT,
      windowSeconds: REPLAY_WINDOW_SECONDS,
      key: (req) => {
        const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        return `replay:${currentUserId(req)}:${runId}`;
      },
    }),
    async (req: Request, res: Response) => {
      const runId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const original = await ownedRun(currentUserId(req), runId);
      if (!original) {
        res.status(404).json({ error: "not found" });
        return;
      }

      const idempotencyKey = typeof req.header("idempotency-key") === "string" ? req.header("idempotency-key") : null;
      if (idempotencyKey) {
        const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
        if (existing?.zapRunId) {
          res.status(201).json({
            zapRunId: existing.zapRunId,
            sourceRunId: original.id,
            zapRevision: original.zapRevision,
          });
          return;
        }
      }

      const key = idempotencyKey || randomUUID();
      const replayed = await prisma.$transaction(async (tx) => {
        const run = await tx.zapRun.create({
          data: {
            zapId: original.zapId,
            zapRevision: original.zapRevision,
            status: "PENDING",
            metadata: (original.metadata ?? {}) as object,
          },
        });
        await tx.zapRunOutbox.create({ data: { zapRunId: run.id, zapId: original.zapId } });
        await tx.idempotencyKey.create({
          data: {
            key,
            zapId: original.zapId,
            zapRunId: run.id,
            expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000),
          },
        });
        return run;
      });

      res.status(201).json({
        zapRunId: replayed.id,
        sourceRunId: original.id,
        zapRevision: replayed.zapRevision,
      });
    },
  );

  return router;
}
