import { Router, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { env } from "@repo/config";
import { zapCreateSchema, zapUpdateSchema } from "@repo/schemas";
import { registry as triggerRegistry, getHandler as getTriggerHandler } from "@repo/triggers";
import { registry as actionRegistry, getHandler as getActionHandler } from "@repo/actions";
import { currentUserId, requireAuth } from "../middleware/auth";
import { checkReauth, sendReauthRequired } from "../lib/reauth";import { byUser, rateLimit } from "../middleware/rateLimit";import { routeParam } from "./folder";
import { TEST_RUN_LIMIT, TEST_RUN_WINDOW_SECONDS } from "../idempotency";

export const ZAP_CREATE_LIMIT = 20;
export const TEST_TRIGGER_LIMIT = 10;
export const TEST_TRIGGER_WINDOW = 60;
export const SAMPLE_LIMIT = 3;

export interface ZapRouteDeps {
  secret: string;
}

export async function triggerSlugFor(id: string): Promise<string> {
  const row = await prisma.availableTrigger.findUnique({ where: { id } });
  if (!row) throw new Error("unknown trigger");
  return row.slug;
}

export async function actionSlugFor(id: string): Promise<string> {
  const row = await prisma.availableAction.findUnique({ where: { id } });
  if (!row) throw new Error("unknown action");
  return row.slug;
}

export function webhookUrl(zapId: string): string {
  return `${env.HOOKS_URL || "http://localhost:3002"}/hooks/catch/${zapId}`;
}

export async function createZap(req: Request, res: Response): Promise<void> {
  const idempotencyKey = typeof req.header("idempotency-key") === "string" ? req.header("idempotency-key") : null;

  if (idempotencyKey) {
    const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
    if (existing?.zapId) {
      const zap = await prisma.zap.findUnique({ where: { id: existing.zapId } });
      if (zap) {
        const secret = await prisma.webhookSecret.findUnique({ where: { zapId: zap.id } });
        res.status(201).json({
          zapId: zap.id,
          webhookUrl: webhookUrl(zap.id),
          secret: secret?.secret ?? null,
          revision: zap.revision,
        });
        return;
      }
    }
  }

  const parsed = zapCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid request" });
    return;
  }
  const input = parsed.data;

  try {
    await triggerSlugFor(input.availableTriggerId);
    for (const action of input.actions) {
      await actionSlugFor(action.availableActionId);
    }
  } catch {
    res.status(400).json({ error: "invalid request" });
    return;
  }

  if (input.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: input.folderId, userId: currentUserId(req) },
    });
    if (!folder) {
      res.status(404).json({ error: "not found" });
      return;
    }
  }

  for (const action of input.actions) {
    if (!action.connectionId) continue;
    const connection = await prisma.connectedAccount.findFirst({
      where: { id: action.connectionId, userId: currentUserId(req) },
    });
    if (!connection) {
      res.status(404).json({ error: "not found" });
      return;
    }
  }

  const secret = randomBytes(24).toString("hex");
  const zap = await prisma.$transaction(async (tx) => {
    const created = await tx.zap.create({
      data: {
        userId: currentUserId(req),
        name: input.name ?? null,
        folderId: input.folderId ?? null,
        active: true,
        revision: 1,
      },
    });
    await tx.trigger.create({
      data: {
        zapId: created.id,
        availableTriggerId: input.availableTriggerId,
        metadata: input.triggerMetadata as object,
      },
    });
    for (const [index, action] of input.actions.entries()) {
      await tx.action.create({
        data: {
          zapId: created.id,
          availableActionId: action.availableActionId,
          metadata: action.actionMetadata as object,
          sortingOrder: index,
          connectionId: action.connectionId ?? null,
        },
      });
    }
    await tx.webhookSecret.create({ data: { zapId: created.id, secret } });
    return created;
  });

  res.status(201).json({
    zapId: zap.id,
    webhookUrl: webhookUrl(zap.id),
    secret,
    revision: zap.revision,
  });

  if (idempotencyKey) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.idempotencyKey.upsert({
      where: { key: idempotencyKey },
      update: { zapId: zap.id },
      create: { key: idempotencyKey, zapId: zap.id, expiresAt },
    });
  }
}

export function zapRouter(deps: ZapRouteDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.secret));

  router.post(
    "/",
    rateLimit({ limit: ZAP_CREATE_LIMIT, windowSeconds: 86400, key: (req) => byUser(currentUserId(req)) }),
    createZap,
  );

  router.get("/", async (req: Request, res: Response) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const folderId = typeof req.query.folderId === "string" ? req.query.folderId : undefined;
    const activeRaw = req.query.active;
    const active = activeRaw === "true" ? true : activeRaw === "false" ? false : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limitRaw = req.query.limit;
    const limit = Math.min(100, Math.max(1, Number(limitRaw) || 20));

    const rows = await prisma.zap.findMany({
      where: {
        userId: currentUserId(req),
        ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        ...(folderId ? { folderId } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      zaps: page,
      nextCursor: hasMore ? page.at(-1)!.id : null,
      limit,
    });
  });

  router.get("/:id", async (req: Request, res: Response) => {
    const zap = await prisma.zap.findFirst({
      where: { id: routeParam(req, "id"), userId: currentUserId(req) },
      include: { trigger: true, actions: { orderBy: { sortingOrder: "asc" } }, webhookSecret: true },
    });
    if (!zap) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({
      id: zap.id,
      name: zap.name,
      active: zap.active,
      revision: zap.revision,
      folderId: zap.folderId,
      webhookUrl: webhookUrl(zap.id),
      trigger: zap.trigger,
      actions: zap.actions,
    });
  });

  router.put("/:id", async (req: Request, res: Response) => {
    const ifMatch = req.header("if-match");
    const parsed = zapUpdateSchema.safeParse(req.body);
    if (!parsed.success || !ifMatch) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const existing = await prisma.zap.findFirst({
      where: { id: routeParam(req, "id"), userId: currentUserId(req) },
    });
    if (!existing) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (Number(ifMatch) !== existing.revision) {
      res.status(409).json({ error: "revision conflict", revision: existing.revision });
      return;
    }

    const input = parsed.data;
    try {
      await triggerSlugFor(input.availableTriggerId);
      for (const action of input.actions) await actionSlugFor(action.availableActionId);
    } catch {
      res.status(400).json({ error: "invalid request" });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.zap.update({
        where: { id: existing.id },
        data: {
          revision: { increment: 1 },
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.folderId !== undefined ? { folderId: input.folderId ?? null } : {}),
        },
      });
      await tx.trigger.deleteMany({ where: { zapId: existing.id } });
      await tx.trigger.create({
        data: {
          zapId: existing.id,
          availableTriggerId: input.availableTriggerId,
          metadata: input.triggerMetadata as object,
        },
      });
      await tx.action.deleteMany({ where: { zapId: existing.id } });
      for (const [index, action] of input.actions.entries()) {
        await tx.action.create({
          data: {
            zapId: existing.id,
            availableActionId: action.availableActionId,
            metadata: action.actionMetadata as object,
            sortingOrder: index,
            connectionId: action.connectionId ?? null,
          },
        });
      }
      return next;
    });

    res.json({ id: updated.id, revision: updated.revision });
  });

  router.patch("/:id/active", async (req: Request, res: Response) => {
    const active = req.body?.active;
    if (typeof active !== "boolean") {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const updated = await prisma.zap.updateMany({
      where: { id: routeParam(req, "id"), userId: currentUserId(req) },
      data: { active },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ id: routeParam(req, "id"), active });
  });

  router.post(
    "/:id/test",
    rateLimit({ limit: TEST_RUN_LIMIT, windowSeconds: TEST_RUN_WINDOW_SECONDS, key: (req) => `zap-test:${currentUserId(req)}` }),
    async (req: Request, res: Response) => {
      const zapId = routeParam(req, "id");
      const zap = await prisma.zap.findFirst({
        where: { id: zapId, userId: currentUserId(req) },
        include: { trigger: true },
      });
      if (!zap) {
        res.status(404).json({ error: "not found" });
        return;
      }

      const sample = { test: true } as Record<string, unknown>;
      try {
        const slug = await triggerSlugFor(zap.trigger?.availableTriggerId ?? "");
        const handler = getTriggerHandler(triggerRegistry, slug);
        const items = await handler.fetchSample({ metadata: (zap.trigger?.metadata ?? {}) as never });
        if (items.length > 0) sample.sample = items[0];
      } catch {
        sample.sample = null;
      }

    const idempotencyKey = typeof req.header("idempotency-key") === "string" ? req.header("idempotency-key") : null;
    if (idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (existing?.zapRunId) {
        res.status(201).json({ zapRunId: existing.zapRunId });
        return;
      }
    }

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.zapRun.create({
        data: {
          zapId: zap.id,
          zapRevision: zap.revision,
          status: "PENDING",
          metadata: JSON.parse(JSON.stringify(sample)),
        },
      });
      await tx.zapRunOutbox.create({ data: { zapRunId: created.id, zapId: zap.id } });
      return created;
    });

    if (idempotencyKey) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await prisma.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        update: { zapRunId: run.id, zapId: zap.id },
        create: { key: idempotencyKey, zapId: zap.id, zapRunId: run.id, expiresAt },
      });
    }

    res.status(201).json({ zapRunId: run.id });
  },
);

  router.post("/:id/secret/rotate", async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const reauth = await checkReauth(req, userId);
    if (!reauth.ok) {
      sendReauthRequired(res);
      return;
    }
    const zap = await prisma.zap.findFirst({
      where: { id: routeParam(req, "id"), userId },
    });
    if (!zap) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const secret = randomBytes(24).toString("hex");
    await prisma.webhookSecret.update({
      where: { zapId: zap.id },
      data: { secret, rotatedAt: new Date() },
    });
    res.json({ zapId: zap.id, secret });
  });

  return router;
}

export function testTriggerRouter(): Router {
  const router = Router();

  router.post(
    "/",
    rateLimit({ limit: TEST_TRIGGER_LIMIT, windowSeconds: TEST_TRIGGER_WINDOW, key: (req) => `test-trigger:${currentUserId(req)}` }),
    async (req: Request, res: Response) => {
      const body = req.body ?? {};
      if (typeof body.availableTriggerId !== "string") {
        res.status(400).json({ error: "invalid request" });
        return;
      }
      let slug: string;
      try {
        slug = await triggerSlugFor(body.availableTriggerId);
      } catch {
        res.status(404).json({ error: "not found" });
        return;
      }

      let connection;
      if (body.connectionId) {
        connection = await prisma.connectedAccount.findFirst({
          where: { id: body.connectionId, userId: currentUserId(req) },
        });
        if (!connection) {
          res.status(404).json({ error: "not found" });
          return;
        }
        connection = {
          id: connection.id,
          app: connection.app as "gmail" | "github",
          accountLabel: connection.accountLabel,
          accessToken: connection.accessEnc ?? "",
          refreshToken: connection.refreshEnc,
          expiresAt: connection.expiresAt,
          scope: connection.scope,
        };
      }

      try {
        const handler = getTriggerHandler(triggerRegistry, slug);
        const items = await handler.fetchSample({
          metadata: (body.triggerMetadata ?? {}) as never,
          connection,
        });
        res.json({ items: items.slice(0, SAMPLE_LIMIT) });
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
      }
    },
  );

  return router;
}

export { actionRegistry, getActionHandler };
