import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { createApp } from "./index";
import { closeRedis } from "./redis";
import {
  BATCH_LIMIT,
  MAX_ATTEMPTS,
  MAX_BACKOFF_SECONDS,
  backoffSeconds,
  claimBatch,
  runOnce,
  type PublishMessage,
  type RelayPublisher,
} from "./relay";

const app = createApp();

function publisher(recorder: PublishMessage[], failTimes = 0, dlt: PublishMessage[] = []): RelayPublisher {
  let failures = failTimes;
  return {
    async publish(message) {
      if (failures > 0) {
        failures--;
        throw new Error("broker down");
      }
      recorder.push(message);
    },
    async publishDeadLetter(message) {
      dlt.push(message);
    },
  };
}

async function seedRun(overrides: { attempts?: number; nextRetryAt?: Date } = {}) {
  const user = await prisma.user.create({
    data: { email: `proc-${Date.now()}-${Math.random()}@example.com` },
  });
  const zap = await prisma.zap.create({ data: { userId: user.id, revision: 3 } });
  const run = await prisma.zapRun.create({
    data: { zapId: zap.id, zapRevision: 3, status: "PENDING", metadata: {} },
  });
  const outbox = await prisma.zapRunOutbox.create({
    data: {
      zapRunId: run.id,
      zapId: zap.id,
      attempts: overrides.attempts ?? 0,
      nextRetryAt: overrides.nextRetryAt ?? new Date(Date.now() - 1000),
    },
  });
  return { zap, run, outbox };
}

beforeEach(async () => {
  await prisma.zapRunOutbox.deleteMany({});
  await prisma.zapRun.deleteMany({});
  await prisma.zap.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

describe("backoff", () => {
  it("doubles per attempt and caps at 300 seconds", () => {
    expect(backoffSeconds(1)).toBe(2);
    expect(backoffSeconds(2)).toBe(4);
    expect(backoffSeconds(3)).toBe(8);
    expect(backoffSeconds(8)).toBe(256);
    expect(backoffSeconds(9)).toBe(MAX_BACKOFF_SECONDS);
    expect(backoffSeconds(50)).toBe(MAX_BACKOFF_SECONDS);
  });
});

describe("claimBatch", () => {
  it("returns due rows joined with the run revision", async () => {
    const { run } = await seedRun();
    const rows = await claimBatch();
    expect(rows).toHaveLength(1);
    expect(rows[0].zapRunId).toBe(run.id);
    expect(rows[0].zapRevision).toBe(3);
  });

  it("skips rows whose nextRetryAt is in the future", async () => {
    await seedRun({ nextRetryAt: new Date(Date.now() + 60_000) });
    expect(await claimBatch()).toHaveLength(0);
  });

  it("honours the batch limit", async () => {
    await seedRun();
    await seedRun();
    expect((await claimBatch(1)).length).toBe(1);
    expect(BATCH_LIMIT).toBe(100);
  });
});

describe("runOnce", () => {
  it("publishes id-only payloads keyed by zapId and deletes the outbox row", async () => {
    const { zap, run, outbox } = await seedRun();
    const sent: PublishMessage[] = [];
    const count = await runOnce(publisher(sent));

    expect(count).toBe(1);
    expect(sent[0]).toEqual({
      zapRunId: run.id,
      zapId: zap.id,
      zapRevision: 3,
      attempt: 0,
    });
    expect(JSON.stringify(sent[0])).not.toContain("metadata");
    expect(await prisma.zapRunOutbox.findUnique({ where: { id: outbox.id } })).toBeNull();
  });

  it("backs off and keeps the row when the broker fails", async () => {
    const { outbox } = await seedRun();
    const sent: PublishMessage[] = [];
    await runOnce(publisher(sent, 1));

    const row = await prisma.zapRunOutbox.findUnique({ where: { id: outbox.id } });
    expect(row).not.toBeNull();
    expect(row!.attempts).toBe(1);
    expect(row!.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("moves to the DLT and marks the run FAILED after 10 attempts", async () => {
    const { run, outbox } = await seedRun({ attempts: MAX_ATTEMPTS });
    const sent: PublishMessage[] = [];
    const dlt: PublishMessage[] = [];

    await runOnce(publisher(sent, 1, dlt));

    expect(dlt).toHaveLength(1);
    expect(sent).toHaveLength(0);
    expect(await prisma.zapRunOutbox.findUnique({ where: { id: outbox.id } })).toBeNull();

    const updated = await prisma.zapRun.findUnique({ where: { id: run.id } });
    expect(updated!.status).toBe("FAILED");
  });

  it("does not silently drop: rows are either deleted or retained with a retry", async () => {
    await seedRun();
    await seedRun();
    const sent: PublishMessage[] = [];
    await runOnce(publisher(sent, 2));
    expect(await prisma.zapRunOutbox.count()).toBe(2);
  });

  it("publishes several rows in one pass", async () => {
    await seedRun();
    await seedRun();
    await seedRun();
    const sent: PublishMessage[] = [];
    expect(await runOnce(publisher(sent))).toBe(3);
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
