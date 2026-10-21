import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "@repo/db";
import { userRouter } from "./user";
import { zapRouter } from "./zap";
import { runsRouter } from "./runs";
import { dashboardRouter } from "./dashboard";
import { closeRedis, getRedis } from "../lib/redis";
import { createMemoryCounter, setRateLimitCounter } from "../middleware/rateLimit";

const SECRET = "0".repeat(32);

function build() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/user", userRouter({ secret: SECRET, mailer: async () => undefined }));
  app.use("/api/v1/zap", zapRouter({ secret: SECRET }));
  app.use("/api/v1", runsRouter({ secret: SECRET }));
  app.use("/api/v1/dashboard", dashboardRouter({ secret: SECRET }));
  return app;
}

const app = build();

async function signUp(email: string) {
  const response = await request(app)
    .post("/api/v1/user/signup")
    .send({ username: email, password: "password123" });
  const cookie = (response.headers["set-cookie"] as unknown as string[])
    .map((c) => c.split(";")[0])
    .join("; ");
  const user = await prisma.user.findUnique({ where: { email } });
  return { cookie, userId: user!.id };
}

async function createZap(userId: string) {
  const trigger = await prisma.availableTrigger.findUnique({ where: { slug: "webhook" } });
  const action = await prisma.availableAction.findUnique({ where: { slug: "email" } });
  const zap = await prisma.zap.create({ data: { userId, name: "History zap" } });
  await prisma.trigger.create({
    data: { zapId: zap.id, availableTriggerId: trigger!.id, metadata: {} },
  });
  const createdAction = await prisma.action.create({
    data: { zapId: zap.id, availableActionId: action!.id, sortingOrder: 0, metadata: {} },
  });
  return { zap, action: createdAction };
}

async function createRun(zapId: string, overrides: Record<string, unknown> = {}) {
  return prisma.zapRun.create({
    data: { zapId, zapRevision: 1, status: "PENDING", metadata: {}, ...overrides },
  });
}

beforeAll(async () => {
  await prisma.$connect();
  const redis = await getRedis();
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(keys);
});

beforeEach(async () => {
  setRateLimitCounter(createMemoryCounter());
  const redis = await getRedis();
  for (const pattern of ["rl:*", "lockout:*", "refresh:*", "denylist:jti:*"]) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(keys);
  }
  await prisma.zapRunStep.deleteMany({});
  await prisma.actionExecution.deleteMany({});
  await prisma.idempotencyKey.deleteMany({});
  await prisma.zapRunOutbox.deleteMany({});
  await prisma.zapRun.deleteMany({});
  await prisma.action.deleteMany({});
  await prisma.trigger.deleteMany({});
  await prisma.zap.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

describe("GET /api/v1/dashboard", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/v1/dashboard")).status).toBe(401);
  });

  it("summarises active zaps, run counts and average latency", async () => {
    const { cookie, userId } = await signUp("dash@example.com");
    await createZap(userId);
    const { zap } = await createZap(userId);
    await prisma.zap.update({ where: { id: zap.id }, data: { active: false } });

    const started = new Date("2026-01-01T00:00:00.000Z");
    await createRun(zap.id, {
      status: "SUCCESS",
      startedAt: started,
      finishedAt: new Date(started.getTime() + 200),
    });
    await createRun(zap.id, { status: "FAILED" });

    const response = await request(app).get("/api/v1/dashboard").set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.totalZaps).toBe(2);
    expect(response.body.activeZaps).toBe(1);
    expect(response.body.runCounts.SUCCESS).toBe(1);
    expect(response.body.runCounts.FAILED).toBe(1);
    expect(response.body.totalRuns).toBe(2);
    expect(response.body.averageLatencyMs).toBe(200);
    expect(response.body.recentRuns.length).toBeGreaterThan(0);
  });

  it("does not leak another users runs", async () => {
    const other = await signUp("dash-other@example.com");
    const { zap } = await createZap(other.userId);
    await createRun(zap.id);

    const { cookie } = await signUp("dash-mine@example.com");
    const response = await request(app).get("/api/v1/dashboard").set("Cookie", cookie);
    expect(response.body.totalZaps).toBe(0);
    expect(response.body.totalRuns).toBe(0);
  });
});

describe("GET /api/v1/zap/:id/runs", () => {
  it("returns an owner scoped paginated list", async () => {
    const { cookie, userId } = await signUp("runs@example.com");
    const { zap } = await createZap(userId);
    for (let i = 0; i < 3; i++) await createRun(zap.id);

    const response = await request(app)
      .get(`/api/v1/zap/${zap.id}/runs?limit=2`)
      .set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.runs).toHaveLength(2);
    expect(response.body.nextCursor).toBeTruthy();
    expect(response.body.limit).toBe(2);
  });

  it("walks the cursor to the next page", async () => {
    const { cookie, userId } = await signUp("cursor@example.com");
    const { zap } = await createZap(userId);
    for (let i = 0; i < 3; i++) await createRun(zap.id);

    const first = await request(app)
      .get(`/api/v1/zap/${zap.id}/runs?limit=2`)
      .set("Cookie", cookie);
    const second = await request(app)
      .get(`/api/v1/zap/${zap.id}/runs?limit=2&cursor=${first.body.nextCursor}`)
      .set("Cookie", cookie);

    expect(second.body.runs).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
    const ids = [...first.body.runs, ...second.body.runs].map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("filters by status", async () => {
    const { cookie, userId } = await signUp("filter-status@example.com");
    const { zap } = await createZap(userId);
    await createRun(zap.id, { status: "SUCCESS" });
    await createRun(zap.id, { status: "FAILED" });

    const response = await request(app)
      .get(`/api/v1/zap/${zap.id}/runs?status=FAILED`)
      .set("Cookie", cookie);
    expect(response.body.runs).toHaveLength(1);
    expect(response.body.runs[0].status).toBe("FAILED");
  });

  it("caps the limit at 100", async () => {
    const { cookie, userId } = await signUp("limit@example.com");
    const { zap } = await createZap(userId);
    const response = await request(app)
      .get(`/api/v1/zap/${zap.id}/runs?limit=500`)
      .set("Cookie", cookie);
    expect(response.status).toBe(400);
  });

  it("hides another users zap behind 404", async () => {
    const other = await signUp("runs-other@example.com");
    const { zap } = await createZap(other.userId);
    const { cookie } = await signUp("runs-mine@example.com");
    const response = await request(app).get(`/api/v1/zap/${zap.id}/runs`).set("Cookie", cookie);
    expect(response.status).toBe(404);
  });
});

describe("GET /api/v1/runs", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/v1/runs")).status).toBe(401);
  });

  it("returns owner-scoped global runs across all zaps with zapName", async () => {
    const { cookie, userId } = await signUp("global-runs@example.com");
    const { zap: zap1 } = await createZap(userId);
    const { zap: zap2 } = await createZap(userId);
    await createRun(zap1.id, { status: "SUCCESS" });
    await createRun(zap2.id, { status: "FAILED" });

    const response = await request(app).get("/api/v1/runs?limit=10").set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.runs).toHaveLength(2);
    expect(response.body.runs[0].zapName).toBe("History zap");
    expect(response.body.nextCursor).toBeNull();
  });

  it("filters global runs by status", async () => {
    const { cookie, userId } = await signUp("filter-global@example.com");
    const { zap } = await createZap(userId);
    await createRun(zap.id, { status: "SUCCESS" });
    await createRun(zap.id, { status: "FAILED" });

    const response = await request(app).get("/api/v1/runs?status=FAILED").set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.runs).toHaveLength(1);
    expect(response.body.runs[0].status).toBe("FAILED");
  });

  it("paginates with cursor", async () => {
    const { cookie, userId } = await signUp("paginate-global@example.com");
    const { zap } = await createZap(userId);
    for (let i = 0; i < 3; i++) await createRun(zap.id);

    const first = await request(app).get("/api/v1/runs?limit=2").set("Cookie", cookie);
    expect(first.body.runs).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app)
      .get(`/api/v1/runs?limit=2&cursor=${first.body.nextCursor}`)
      .set("Cookie", cookie);
    expect(second.body.runs).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe("GET /api/v1/runs/:id", () => {
  it("returns the run with ordered steps", async () => {
    const { cookie, userId } = await signUp("detail@example.com");
    const { zap, action } = await createZap(userId);
    const run = await createRun(zap.id, { status: "SUCCESS" });
    await prisma.zapRunStep.create({
      data: {
        zapRunId: run.id,
        actionId: action.id,
        order: 0,
        status: "SUCCESS",
        input: { to: "a@b.com" },
        output: { messageId: "m1" },
        latency: 42,
      },
    });

    const response = await request(app).get(`/api/v1/runs/${run.id}`).set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.steps).toHaveLength(1);
    expect(response.body.steps[0]).toMatchObject({ order: 0, status: "SUCCESS", latency: 42 });
  });

  it("hides another users run", async () => {
    const other = await signUp("run-other@example.com");
    const { zap } = await createZap(other.userId);
    const run = await createRun(zap.id);
    const { cookie } = await signUp("run-mine@example.com");
    const response = await request(app).get(`/api/v1/runs/${run.id}`).set("Cookie", cookie);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/runs/:id/replay", () => {
  it("clones metadata and revision into a new run with a fresh key", async () => {
    const { cookie, userId } = await signUp("replay@example.com");
    const { zap } = await createZap(userId);
    const original = await createRun(zap.id, {
      zapRevision: 4,
      status: "FAILED",
      metadata: { hello: "world" },
    });

    const response = await request(app)
      .post(`/api/v1/runs/${original.id}/replay`)
      .set("Cookie", cookie);
    expect(response.status).toBe(201);
    expect(response.body.sourceRunId).toBe(original.id);
    expect(response.body.zapRunId).not.toBe(original.id);

    const clone = await prisma.zapRun.findUnique({ where: { id: response.body.zapRunId } });
    expect(clone!.metadata).toEqual({ hello: "world" });
    expect(clone!.zapRevision).toBe(4);
    expect(clone!.status).toBe("PENDING");

    expect(await prisma.zapRunOutbox.count({ where: { zapRunId: clone!.id } })).toBe(1);
    const key = await prisma.idempotencyKey.findFirst({ where: { zapRunId: clone!.id } });
    expect(key).not.toBeNull();
  });

  it("uses a new idempotency key on every replay", async () => {
    const { cookie, userId } = await signUp("replay-keys@example.com");
    const { zap } = await createZap(userId);
    const original = await createRun(zap.id);

    await request(app).post(`/api/v1/runs/${original.id}/replay`).set("Cookie", cookie);
    await request(app).post(`/api/v1/runs/${original.id}/replay`).set("Cookie", cookie);

    const keys = await prisma.idempotencyKey.findMany({
      where: { zapRunId: { not: original.id } },
    });
    expect(keys).toHaveLength(2);
    expect(keys[0].key).not.toBe(keys[1].key);
  });

  it("cannot replay another users run", async () => {
    const other = await signUp("replay-other@example.com");
    const { zap } = await createZap(other.userId);
    const run = await createRun(zap.id);
    const { cookie } = await signUp("replay-mine@example.com");

    const response = await request(app).post(`/api/v1/runs/${run.id}/replay`).set("Cookie", cookie);
    expect(response.status).toBe(404);
  });

  it("rate limits to 10 replays per day per run", async () => {
    const { cookie, userId } = await signUp("replay-limit@example.com");
    const { zap } = await createZap(userId);
    const original = await createRun(zap.id);

    for (let i = 0; i < 10; i++) {
      const ok = await request(app).post(`/api/v1/runs/${original.id}/replay`).set("Cookie", cookie);
      expect(ok.status).toBe(201);
    }
    const blocked = await request(app)
      .post(`/api/v1/runs/${original.id}/replay`)
      .set("Cookie", cookie);
    expect(blocked.status).toBe(429);
  });
});

describe("POST /api/v1/zap/:id/test", () => {
  it("fires a synthetic run with a sample payload without scheduling", async () => {
    const { cookie, userId } = await signUp("zaptest@example.com");
    const { zap } = await createZap(userId);

    const response = await request(app).post(`/api/v1/zap/${zap.id}/test`).set("Cookie", cookie);
    expect(response.status).toBe(201);

    const run = await prisma.zapRun.findUnique({ where: { id: response.body.zapRunId } });
    expect((run!.metadata as { test: boolean }).test).toBe(true);
    expect(await prisma.zapRunOutbox.count({ where: { zapRunId: run!.id } })).toBe(1);
    expect(await prisma.trigger.count({ where: { zapId: zap.id, nextRunAt: { not: null } } })).toBe(0);
  });

  it("cannot test another users zap", async () => {
    const other = await signUp("zaptest-other@example.com");
    const { zap } = await createZap(other.userId);
    const { cookie } = await signUp("zaptest-mine@example.com");
    const response = await request(app).post(`/api/v1/zap/${zap.id}/test`).set("Cookie", cookie);
    expect(response.status).toBe(404);
  });
});
