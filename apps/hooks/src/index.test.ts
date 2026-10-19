import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "@repo/db";
import { createApp } from "./index";
import { closeRedis, getRedis } from "./redis";
import { IDEMPOTENCY_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER, sign } from "./verify";

const app = createApp();
const SECRET = "0123456789abcdef0123456789abcdef";

async function seedZap(overrides: { active?: boolean; secret?: string } = {}) {
  const user = await prisma.user.create({ data: { email: `hook-${Date.now()}-${Math.random()}@example.com` } });
  const zap = await prisma.zap.create({ data: { userId: user.id } });
  await prisma.webhookSecret.create({
    data: { zapId: zap.id, secret: overrides.secret ?? SECRET },
  });
  if (overrides.active === undefined) return zap.id;
  await prisma.zap.update({ where: { id: zap.id }, data: { active: overrides.active } });
  return zap.id;
}

function signed(zapSecret: string, body: string, opts: { ts?: string; key?: string } = {}) {
  const ts = opts.ts ?? String(Math.floor(Date.now() / 1000));
  const payload = { payload: body };
  return {
    [SIGNATURE_HEADER]: sign(zapSecret, ts, body),
    [TIMESTAMP_HEADER]: ts,
    [IDEMPOTENCY_HEADER]: opts.key ?? crypto.randomUUID(),
    send: payload,
  };
}

async function post(zapId: string, body: string, opts: { ts?: string; key?: string; secret?: string } = {}) {
  const headers = signed(opts.secret ?? SECRET, body, opts);
  return request(app)
    .post(`/hooks/catch/${zapId}`)
    .set(SIGNATURE_HEADER, headers[SIGNATURE_HEADER])
    .set(TIMESTAMP_HEADER, headers[TIMESTAMP_HEADER])
    .set(IDEMPOTENCY_HEADER, headers[IDEMPOTENCY_HEADER])
    .send(body);
}

beforeEach(async () => {
  const redis = await getRedis();
  const keys = await redis.keys("hook:*");
  if (keys.length) await redis.del(keys);
  await prisma.idempotencyKey.deleteMany({});
  await prisma.zapRunOutbox.deleteMany({});
  await prisma.zapRun.deleteMany({});
  await prisma.webhookSecret.deleteMany({});
  await prisma.trigger.deleteMany({});
  await prisma.action.deleteMany({});
  await prisma.zap.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

describe("POST /hooks/catch/:zapId", () => {
  it("accepts a correctly signed payload and returns a zapRunId", async () => {
    const zapId = await seedZap();
    const response = await post(zapId, JSON.stringify({ hello: "world" }));
    expect(response.status).toBe(200);
    expect(response.body.zapRunId).toBeTruthy();
  });

  it("creates ZapRun PENDING plus an outbox row in one transaction", async () => {
    const zapId = await seedZap();
    const response = await post(zapId, JSON.stringify({ n: 1 }));

    const run = await prisma.zapRun.findUnique({ where: { id: response.body.zapRunId } });
    expect(run!.status).toBe("PENDING");
    expect(run!.metadata).toEqual({ n: 1 });

    const outbox = await prisma.zapRunOutbox.findFirst({ where: { zapRunId: run!.id } });
    expect(outbox).not.toBeNull();
    expect(outbox!.zapId).toBe(zapId);
  });

  it("pins zapRevision on the run", async () => {
    const zapId = await seedZap();
    await prisma.zap.update({ where: { id: zapId }, data: { revision: 7 } });
    const response = await post(zapId, "{}");
    const run = await prisma.zapRun.findUnique({ where: { id: response.body.zapRunId } });
    expect(run!.zapRevision).toBe(7);
  });

  it("never runs actions inline", async () => {
    const zapId = await seedZap();
    await post(zapId, "{}");
    expect(await prisma.actionExecution.count()).toBe(0);
    expect(await prisma.zapRunStep.count()).toBe(0);
  });

  it("returns 404 for an unknown zap", async () => {
    const response = await post("no-such-zap", "{}");
    expect(response.status).toBe(404);
  });

  it("returns 404 for an inactive zap", async () => {
    const zapId = await seedZap({ active: false });
    const response = await post(zapId, "{}");
    expect(response.status).toBe(404);
  });
});

describe("signature verification", () => {
  it("rejects a wrong signature with 401", async () => {
    const zapId = await seedZap();
    const response = await post(zapId, "{}", { secret: "wrong-secret-entirely-value" });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("signature-mismatch");
  });

  it("rejects a missing signature", async () => {
    const zapId = await seedZap();
    const response = await request(app).post(`/hooks/catch/${zapId}`).send("{}");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("missing-signature");
  });

  it("rejects a body that changed after signing", async () => {
    const zapId = await seedZap();
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign(SECRET, ts, "original");
    const response = await request(app)
      .post(`/hooks/catch/${zapId}`)
      .set(SIGNATURE_HEADER, signature)
      .set(TIMESTAMP_HEADER, ts)
      .set(IDEMPOTENCY_HEADER, crypto.randomUUID())
      .send("tampered");
    expect(response.status).toBe(401);
  });

  it("rejects a stale timestamp outside the 5 minute window", async () => {
    const zapId = await seedZap();
    const stale = String(Math.floor(Date.now() / 1000) - 600);
    const response = await post(zapId, "{}", { ts: stale });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("stale-timestamp");
  });

  it("accepts a timestamp inside the window", async () => {
    const zapId = await seedZap();
    const recent = String(Math.floor(Date.now() / 1000) - 60);
    const response = await post(zapId, "{}", { ts: recent });
    expect(response.status).toBe(200);
  });

  it("rejects a body over 1MB with 413", async () => {
    const zapId = await seedZap();
    const huge = JSON.stringify({ blob: "x".repeat(1024 * 1024 + 512) });
    const response = await post(zapId, huge);
    expect(response.status).toBe(413);
  });

  it("rejects malformed json", async () => {
    const zapId = await seedZap();
    const response = await post(zapId, "{not json");
    expect(response.status).toBe(400);
  });
});

describe("idempotency", () => {
  it("replays the same key to the original zapRunId with no new row", async () => {
    const zapId = await seedZap();
    const key = crypto.randomUUID();

    const first = await post(zapId, "{}", { key });
    expect(first.status).toBe(200);

    const second = await post(zapId, "{}", { key });
    expect(second.status).toBe(200);
    expect(second.body.zapRunId).toBe(first.body.zapRunId);

    expect(await prisma.zapRun.count({ where: { zapId } })).toBe(1);
  });

  it("requires an idempotency key", async () => {
    const zapId = await seedZap();
    const ts = String(Math.floor(Date.now() / 1000));
    const response = await request(app)
      .post(`/hooks/catch/${zapId}`)
      .set(SIGNATURE_HEADER, sign(SECRET, ts, "{}"))
      .set(TIMESTAMP_HEADER, ts)
      .send("{}");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("missing-idempotency-key");
  });

  it("rejects a non uuid key", async () => {
    const zapId = await seedZap();
    const response = await post(zapId, "{}", { key: "not-a-uuid" });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid-idempotency-key");
  });

  it("stores a 30 day expiry on the key", async () => {
    const zapId = await seedZap();
    const key = crypto.randomUUID();
    await post(zapId, "{}", { key });
    const record = await prisma.idempotencyKey.findUnique({ where: { key } });
    const days = (record!.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

describe("rate limits", () => {
  it("blocks after 60 requests per minute per ip", async () => {
    const zapId = await seedZap();
    let blocked = false;
    for (let i = 0; i < 65; i++) {
      const response = await post(zapId, "{}");
      if (response.status === 429) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
  });
});

describe("health endpoints", () => {
  it("serves healthz without dependencies", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("reports readiness", async () => {
    const response = await request(app).get("/readyz");
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty("database");
    expect(response.body).toHaveProperty("redis");
  });
});
