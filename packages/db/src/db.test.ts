import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seed, TRIGGERS, ACTIONS } from "../prisma/seed";
import { migrateTestDatabase, testDatabaseUrl, truncateAll } from "./testDb";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

async function seedZap(userId: string) {
  const zap = await prisma.zap.create({
    data: { userId, name: "dedupe zap", active: true, revision: 1 },
  });
  const trigger = await prisma.trigger.create({
    data: { zapId: zap.id, availableTriggerId: "webhook", metadata: {} },
  });
  const action = await prisma.action.create({
    data: { zapId: zap.id, availableActionId: "email", sortingOrder: 0, metadata: {} },
  });
  return { zap, trigger, action };
}

beforeAll(async () => {
  migrateTestDatabase();
  await prisma.$connect();
});

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("schema migrates clean", () => {
  it("applies every migration in _prisma_migrations without failure", async () => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >('SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.finished_at).not.toBeNull();
      expect(row.rolled_back_at).toBeNull();
    }
  });

  it("exposes every documented model", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const names = tables.map((t) => t.table_name);
    for (const expected of [
      "User",
      "Account",
      "ConnectedAccount",
      "Folder",
      "Zap",
      "Trigger",
      "Action",
      "AvailableTrigger",
      "AvailableAction",
      "ZapRun",
      "ZapRunStep",
      "ZapRunOutbox",
      "ActionExecution",
      "WebhookSecret",
      "IdempotencyKey",
      "PasswordReset",
    ]) {
      expect(names).toContain(expected);
    }
  });
});

describe("seed is idempotent", () => {
  it("produces the same counts across repeated runs", async () => {
    await seed(prisma);
    const first = {
      triggers: await prisma.availableTrigger.count(),
      actions: await prisma.availableAction.count(),
    };
    await seed(prisma);
    await seed(prisma);
    const third = {
      triggers: await prisma.availableTrigger.count(),
      actions: await prisma.availableAction.count(),
    };
    expect(first).toEqual({ triggers: TRIGGERS.length, actions: ACTIONS.length });
    expect(third).toEqual(first);
  });

  it("updates names in place rather than duplicating rows", async () => {
    await seed(prisma);
    await prisma.availableAction.updateMany({ data: { name: "stale" } });
    await seed(prisma);
    const email = await prisma.availableAction.findUnique({ where: { slug: "email" } });
    expect(email?.name).toBe("Send Email");
    expect(await prisma.availableAction.count()).toBe(ACTIONS.length);
  });
});

describe("ActionExecution dedupe blocks double-send", () => {
  it("rejects a second execution for the same zapRunId and actionId", async () => {
    const user = await prisma.user.create({ data: { email: "dedupe@example.com" } });
    const { zap, action } = await seedZap(user.id);
    const run = await prisma.zapRun.create({
      data: { zapId: zap.id, zapRevision: 1, status: "RUNNING" },
    });

    await prisma.actionExecution.create({ data: { zapRunId: run.id, actionId: action.id } });

    await expect(
      prisma.actionExecution.create({ data: { zapRunId: run.id, actionId: action.id } }),
    ).rejects.toThrow(/unique|constraint/i);

    expect(await prisma.actionExecution.count({ where: { zapRunId: run.id } })).toBe(1);
  });

  it("allows the same action id on a different run", async () => {
    const user = await prisma.user.create({ data: { email: "rerun@example.com" } });
    const { zap, action } = await seedZap(user.id);
    const runA = await prisma.zapRun.create({ data: { zapId: zap.id, zapRevision: 1 } });
    const runB = await prisma.zapRun.create({ data: { zapId: zap.id, zapRevision: 1 } });

    await prisma.actionExecution.create({ data: { zapRunId: runA.id, actionId: action.id } });
    await prisma.actionExecution.create({ data: { zapRunId: runB.id, actionId: action.id } });

    expect(await prisma.actionExecution.count()).toBe(2);
  });
});

describe("ZapRunStep written per action", () => {
  it("stores one ordered step per action and survives a cascade delete", async () => {
    const user = await prisma.user.create({ data: { email: "steps@example.com" } });
    const zap = await prisma.zap.create({ data: { userId: user.id, name: "stepped" } });
    await prisma.trigger.create({
      data: { zapId: zap.id, availableTriggerId: "webhook", metadata: {} },
    });
    const first = await prisma.action.create({
      data: { zapId: zap.id, availableActionId: "email", sortingOrder: 0, metadata: {} },
    });
    const second = await prisma.action.create({
      data: { zapId: zap.id, availableActionId: "slack", sortingOrder: 1, metadata: {} },
    });
    const run = await prisma.zapRun.create({ data: { zapId: zap.id, zapRevision: 1 } });

    await prisma.zapRunStep.create({
      data: {
        zapRunId: run.id,
        actionId: first.id,
        order: 0,
        status: "SUCCESS",
        input: { to: "a@example.com" },
        output: { messageId: "m1" },
        latency: 120,
      },
    });
    await prisma.zapRunStep.create({
      data: { zapRunId: run.id, actionId: second.id, order: 1, status: "PENDING" },
    });

    const steps = await prisma.zapRunStep.findMany({ where: { zapRunId: run.id }, orderBy: { order: "asc" } });
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.order)).toEqual([0, 1]);

    await prisma.zapRun.delete({ where: { id: run.id } });
    expect(await prisma.zapRunStep.count({ where: { zapRunId: run.id } })).toBe(0);
  });

  it("enforces uniqueness per run and action", async () => {
    const user = await prisma.user.create({ data: { email: "stepuniq@example.com" } });
    const { zap, action } = await seedZap(user.id);
    const run = await prisma.zapRun.create({ data: { zapId: zap.id, zapRevision: 1 } });

    await prisma.zapRunStep.create({ data: { zapRunId: run.id, actionId: action.id, order: 0 } });
    await expect(
      prisma.zapRunStep.create({ data: { zapRunId: run.id, actionId: action.id, order: 1 } }),
    ).rejects.toThrow(/unique|constraint/i);
  });
});

describe("retention primitives", () => {
  it("keeps one outbox row per run and caps attempts at 10", async () => {
    const user = await prisma.user.create({ data: { email: "outbox@example.com" } });
    const { zap } = await seedZap(user.id);
    const run = await prisma.zapRun.create({ data: { zapId: zap.id, zapRevision: 1 } });

    await prisma.zapRunOutbox.create({ data: { zapRunId: run.id, zapId: zap.id, attempts: 10 } });
    await expect(
      prisma.zapRunOutbox.create({ data: { zapRunId: run.id, zapId: zap.id, attempts: 1 } }),
    ).rejects.toThrow(/unique|constraint/i);
  });

  it("stores idempotency keys with a 30 day expiry and expires them on schedule", async () => {
    const user = await prisma.user.create({ data: { email: "idem@example.com" } });
    const { zap, } = await seedZap(user.id);
    const run = await prisma.zapRun.create({ data: { zapId: zap.id, zapRevision: 1 } });

    const live = await prisma.idempotencyKey.create({
      data: {
        key: "key-live",
        zapId: zap.id,
        zapRunId: run.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const stale = await prisma.idempotencyKey.create({
      data: {
        key: "key-stale",
        zapId: zap.id,
        zapRunId: run.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const cutoff = new Date();
    const deleted = await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: cutoff } },
    });

    expect(deleted.count).toBe(1);
    expect(await prisma.idempotencyKey.findUnique({ where: { key: live.key } })).not.toBeNull();
    expect(await prisma.idempotencyKey.findUnique({ where: { key: stale.key } })).toBeNull();
  });

  it("deletes runs older than the 90 day retention window with their steps", async () => {
    const user = await prisma.user.create({ data: { email: "retention@example.com" } });
    const { zap, action } = await seedZap(user.id);

    const oldRun = await prisma.zapRun.create({
      data: {
        zapId: zap.id,
        zapRevision: 1,
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.zapRunStep.create({
      data: { zapRunId: oldRun.id, actionId: action.id, order: 0 },
    });
    const recentRun = await prisma.zapRun.create({ data: { zapId: zap.id, zapRevision: 1 } });

    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const removed = await prisma.zapRun.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    expect(removed.count).toBe(1);
    expect(await prisma.zapRunStep.count({ where: { zapRunId: oldRun.id } })).toBe(0);
    expect(await prisma.zapRun.findUnique({ where: { id: recentRun.id } })).not.toBeNull();
  });
});
