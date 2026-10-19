import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { createApp } from "./index";
import { closeRedis } from "./redis";
import { BATCH_LIMIT, TICK_INTERVAL_MS, tick } from "./jobs";

const app = createApp();

async function seedSchedule(options: { active?: boolean; cron?: string; nextRunAt?: Date } = {}) {
  const user = await prisma.user.create({
    data: { email: `s-${Date.now()}-${Math.random()}@example.com` },
  });
  const zap = await prisma.zap.create({
    data: { userId: user.id, active: options.active ?? true },
  });
  const available = await prisma.availableTrigger.findUnique({ where: { slug: "schedule" } });
  const trigger = await prisma.trigger.create({
    data: {
      zapId: zap.id,
      availableTriggerId: available!.id,
      metadata: { cron: options.cron ?? "* * * * *" },
      nextRunAt: options.nextRunAt ?? new Date(Date.now() - 1000),
    },
  });
  return { zap, trigger };
}

beforeEach(async () => {
  await prisma.zapRunOutbox.deleteMany({});
  await prisma.zapRun.deleteMany({});
  await prisma.trigger.deleteMany({});
  await prisma.zap.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

describe("tick", () => {
  it("creates a ZapRun plus outbox row for a due trigger", async () => {
    const { zap } = await seedSchedule();
    const result = await tick();

    expect(result.created).toBe(1);
    const runs = await prisma.zapRun.findMany({ where: { zapId: zap.id } });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("PENDING");
    const outbox = await prisma.zapRunOutbox.findFirst({ where: { zapRunId: runs[0].id } });
    expect(outbox).not.toBeNull();
  });

  it("advances nextRunAt so the same trigger does not fire twice", async () => {
    const { trigger } = await seedSchedule();
    await tick();
    const after = await prisma.trigger.findUnique({ where: { id: trigger.id } });
    expect(after!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());

    const second = await tick();
    expect(second.created).toBe(0);
  });

  it("skips inactive zaps", async () => {
    await seedSchedule({ active: false });
    const result = await tick();
    expect(result.created).toBe(0);
    expect(result.skippedInactive).toBe(1);
    expect(await prisma.zapRun.count()).toBe(0);
  });

  it("ignores triggers that are not yet due", async () => {
    await seedSchedule({ nextRunAt: new Date(Date.now() + 600_000) });
    const result = await tick();
    expect(result.created).toBe(0);
  });

  it("ignores an invalid cron expression", async () => {
    await seedSchedule({ cron: "not-a-cron" });
    const result = await tick();
    expect(result.created).toBe(0);
  });

  it("resumes a suspended run whose resumeAt has passed", async () => {
    const { zap } = await seedSchedule();
    const run = await prisma.zapRun.create({
      data: {
        zapId: zap.id,
        zapRevision: 1,
        status: "SUSPENDED",
        resumeAt: new Date(Date.now() - 1000),
      },
    });

    const result = await tick();
    expect(result.resumed).toBe(1);

    const reopened = await prisma.zapRun.findUnique({ where: { id: run.id } });
    expect(reopened!.status).toBe("PENDING");
    expect(reopened!.resumeAt).toBeNull();
    expect(await prisma.zapRunOutbox.count({ where: { zapRunId: run.id } })).toBe(1);
  });

  it("leaves a not-yet-due suspended run suspended", async () => {
    const { zap } = await seedSchedule();
    const run = await prisma.zapRun.create({
      data: {
        zapId: zap.id,
        zapRevision: 1,
        status: "SUSPENDED",
        resumeAt: new Date(Date.now() + 600_000),
      },
    });
    const result = await tick();
    expect(result.resumed).toBe(0);
    const still = await prisma.zapRun.findUnique({ where: { id: run.id } });
    expect(still!.status).toBe("SUSPENDED");
  });

  it("uses the documented 30 second cadence and batch size", () => {
    expect(TICK_INTERVAL_MS).toBe(30000);
    expect(BATCH_LIMIT).toBe(100);
  });
});

describe("health endpoints", () => {
  it("serves healthz", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("reports readiness", async () => {
    const response = await request(app).get("/readyz");
    expect([200, 503]).toContain(response.status);
  });
});
