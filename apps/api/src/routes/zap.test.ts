import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "@repo/db";
import { zapRouter, testTriggerRouter } from "./zap";
import { actionRouter, triggerRouter } from "./catalog";
import { folderRouter } from "./folder";
import { userRouter } from "./user";
import { closeRedis, getRedis } from "../lib/redis";
import { createMemoryCounter, setRateLimitCounter } from "../middleware/rateLimit";

const SECRET = "0".repeat(32);

function build() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/user", userRouter({ secret: SECRET, mailer: async () => undefined }));
  app.use("/api/v1/zap", zapRouter({ secret: SECRET }));
  app.use("/api/v1/zap/test-trigger", testTriggerRouter());
  app.use("/api/v1/trigger", triggerRouter({ secret: SECRET }));
  app.use("/api/v1/action", actionRouter({ secret: SECRET }));
  app.use("/api/v1/folder", folderRouter({ secret: SECRET }));
  return app;
}

const app = build();

async function newUser(email: string): Promise<{ cookie: string; userId: string }> {
  const response = await request(app)
    .post("/api/v1/user/signup")
    .send({ username: email, password: "password123" });
  const cookies = (response.headers["set-cookie"] as unknown as string[])
    .map((c) => c.split(";")[0])
    .join("; ");
  const user = await prisma.user.findUnique({ where: { email } });
  return { cookie: cookies, userId: user!.id };
}

async function seededIds() {
  const trigger = await prisma.availableTrigger.findUnique({ where: { slug: "webhook" } });
  const action = await prisma.availableAction.findUnique({ where: { slug: "email" } });
  return { triggerId: trigger!.id, actionId: action!.id };
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
  await prisma.webhookSecret.deleteMany({});
  await prisma.action.deleteMany({});
  await prisma.trigger.deleteMany({});
  await prisma.zap.deleteMany({});
  await prisma.folder.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

describe("GET /api/v1/trigger/available", () => {
  it("lists seeded triggers with their field specs", async () => {
    const { cookie } = await newUser("cat@example.com");
    const response = await request(app).get("/api/v1/trigger/available").set("Cookie", cookie);
    expect(response.status).toBe(200);
    const schedule = response.body.triggers.find((t: { slug: string }) => t.slug === "schedule");
    expect(schedule).toBeDefined();
    expect(schedule.fields.map((f: { key: string }) => f.key)).toEqual(["cron"]);
  });

  it("requires authentication", async () => {
    expect((await request(app).get("/api/v1/trigger/available")).status).toBe(401);
  });
});

describe("GET /api/v1/action/available", () => {
  it("lists seeded actions with their field specs", async () => {
    const { cookie } = await newUser("act@example.com");
    const response = await request(app).get("/api/v1/action/available").set("Cookie", cookie);
    expect(response.status).toBe(200);
    const delay = response.body.actions.find((a: { slug: string }) => a.slug === "delay");
    expect(delay.fields[0].type).toBe("number");
  });
});

describe("POST /api/v1/zap", () => {
  it("creates zap, trigger, actions and secret atomically", async () => {
    const { cookie, userId } = await newUser("zap@example.com");
    const { triggerId, actionId } = await seededIds();
    const response = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: { to: "a@b.com" } }],
      });

    expect(response.status).toBe(201);
    expect(response.body.zapId).toBeTruthy();
    expect(response.body.secret).toMatch(/^[0-9a-f]{48}$/);
    expect(response.body.revision).toBe(1);

    const zap = await prisma.zap.findUnique({
      where: { id: response.body.zapId },
      include: { trigger: true, actions: true, webhookSecret: true },
    });
    expect(zap!.userId).toBe(userId);
    expect(zap!.trigger).not.toBeNull();
    expect(zap!.actions).toHaveLength(1);
    expect(zap!.actions[0].sortingOrder).toBe(0);
    expect(zap!.webhookSecret!.secret).toBe(response.body.secret);
  });

  it("preserves action order via sortingOrder", async () => {
    const { cookie } = await newUser("order@example.com");
    const { triggerId } = await seededIds();
    const email = (await prisma.availableAction.findUnique({ where: { slug: "email" } }))!.id;
    const slack = (await prisma.availableAction.findUnique({ where: { slug: "slack" } }))!.id;

    const response = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [
          { availableActionId: email, actionMetadata: {} },
          { availableActionId: slack, actionMetadata: {} },
        ],
      });

    const actions = await prisma.action.findMany({
      where: { zapId: response.body.zapId },
      orderBy: { sortingOrder: "asc" },
    });
    expect(actions.map((a) => a.availableActionId)).toEqual([email, slack]);
    expect(actions.map((a) => a.sortingOrder)).toEqual([0, 1]);
  });

  it("rejects an unknown trigger id", async () => {
    const { cookie } = await newUser("bad-trigger@example.com");
    const { actionId } = await seededIds();
    const response = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: "does-not-exist",
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });
    expect(response.status).toBe(400);
  });

  it("rejects a bad {{ref}} in action metadata", async () => {
    const { cookie } = await newUser("badref@example.com");
    const { triggerId, actionId } = await seededIds();
    const response = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: { to: "{{ghost.output.x}}" } }],
      });
    expect(response.status).toBe(400);
  });

  it("rolls back completely when a later action is invalid", async () => {
    const { cookie } = await newUser("rollback@example.com");
    const { triggerId, actionId } = await seededIds();
    await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [
          { availableActionId: actionId, actionMetadata: {} },
          { availableActionId: "nope", actionMetadata: {} },
        ],
      });
    expect(await prisma.zap.count()).toBe(0);
    expect(await prisma.action.count()).toBe(0);
    expect(await prisma.trigger.count()).toBe(0);
  });

  it("requires at least one action", async () => {
    const { cookie } = await newUser("noaction@example.com");
    const { triggerId } = await seededIds();
    const response = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({ availableTriggerId: triggerId, triggerMetadata: {}, actions: [] });
    expect(response.status).toBe(400);
  });
});

describe("GET /api/v1/zap/:id owner scoping", () => {
  it("hides another users zap behind 404", async () => {
    const owner = await newUser("owner@example.com");
    const other = await newUser("other@example.com");
    const { triggerId, actionId } = await seededIds();
    const created = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", owner.cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });

    const mine = await request(app).get(`/api/v1/zap/${created.body.zapId}`).set("Cookie", owner.cookie);
    expect(mine.status).toBe(200);

    const theirs = await request(app).get(`/api/v1/zap/${created.body.zapId}`).set("Cookie", other.cookie);
    expect(theirs.status).toBe(404);
  });
});

describe("PUT /api/v1/zap/:id revision lock", () => {
  async function createZap(cookie: string) {
    const { triggerId, actionId } = await seededIds();
    const response = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });
    return response.body;
  }

  it("bumps the revision on a matching If-Match", async () => {
    const { cookie } = await newUser("put@example.com");
    const zap = await createZap(cookie);
    const { triggerId, actionId } = await seededIds();
    const response = await request(app)
      .put(`/api/v1/zap/${zap.zapId}`)
      .set("Cookie", cookie)
      .set("If-Match", String(zap.revision))
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
        name: "renamed",
      });
    expect(response.status).toBe(200);
    expect(response.body.revision).toBe(2);
    const stored = await prisma.zap.findUnique({ where: { id: zap.zapId } });
    expect(stored!.name).toBe("renamed");
  });

  it("returns 409 on a stale If-Match", async () => {
    const { cookie } = await newUser("stale@example.com");
    const zap = await createZap(cookie);
    const { triggerId, actionId } = await seededIds();
    const response = await request(app)
      .put(`/api/v1/zap/${zap.zapId}`)
      .set("Cookie", cookie)
      .set("If-Match", "99")
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });
    expect(response.status).toBe(409);
    expect(response.body.revision).toBe(zap.revision);
  });

  it("requires the If-Match header", async () => {
    const { cookie } = await newUser("nomatch@example.com");
    const zap = await createZap(cookie);
    const { triggerId, actionId } = await seededIds();
    const response = await request(app)
      .put(`/api/v1/zap/${zap.zapId}`)
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });
    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/v1/zap/:id/active", () => {
  it("toggles active so the scheduler can skip the zap", async () => {
    const { cookie } = await newUser("toggle@example.com");
    const { triggerId, actionId } = await seededIds();
    const created = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });

    const off = await request(app)
      .patch(`/api/v1/zap/${created.body.zapId}/active`)
      .set("Cookie", cookie)
      .send({ active: false });
    expect(off.status).toBe(200);

    const stored = await prisma.zap.findUnique({ where: { id: created.body.zapId } });
    expect(stored!.active).toBe(false);
  });

  it("cannot toggle another users zap", async () => {
    const owner = await newUser("t-owner@example.com");
    const other = await newUser("t-other@example.com");
    const { triggerId, actionId } = await seededIds();
    const created = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", owner.cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });
    const response = await request(app)
      .patch(`/api/v1/zap/${created.body.zapId}/active`)
      .set("Cookie", other.cookie)
      .send({ active: false });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/zap/test-trigger", () => {
  it("returns sample items without creating a ZapRun", async () => {
    const { cookie } = await newUser("sample@example.com");
    const manual = await prisma.availableTrigger.findUnique({ where: { slug: "manual" } });
    const response = await request(app)
      .post("/api/v1/zap/test-trigger")
      .set("Cookie", cookie)
      .send({ availableTriggerId: manual!.id, triggerMetadata: { message: "hi" } });
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].message).toBe("hi");
    expect(await prisma.zapRun.count()).toBe(0);
  });

  it("returns an empty sample set for the passive webhook trigger", async () => {
    const { cookie } = await newUser("webhook-sample@example.com");
    const { triggerId } = await seededIds();
    const response = await request(app)
      .post("/api/v1/zap/test-trigger")
      .set("Cookie", cookie)
      .send({ availableTriggerId: triggerId, triggerMetadata: {} });
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
  });

  it("returns 404 for an unknown trigger", async () => {
    const { cookie } = await newUser("unknown-sample@example.com");
    const response = await request(app)
      .post("/api/v1/zap/test-trigger")
      .set("Cookie", cookie)
      .send({ availableTriggerId: "nope", triggerMetadata: {} });
    expect(response.status).toBe(404);
  });

  it("rate limits to 10 per minute", async () => {
    const { cookie } = await newUser("limit-sample@example.com");
    const { triggerId } = await seededIds();
    for (let i = 0; i < 10; i++) {
      const ok = await request(app)
        .post("/api/v1/zap/test-trigger")
        .set("Cookie", cookie)
        .send({ availableTriggerId: triggerId, triggerMetadata: {} });
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app)
      .post("/api/v1/zap/test-trigger")
      .set("Cookie", cookie)
      .send({ availableTriggerId: triggerId, triggerMetadata: {} });
    expect(blocked.status).toBe(429);
  });
});

describe("folders", () => {
  it("creates, lists, renames and deletes scoped to the owner", async () => {
    const { cookie } = await newUser("folder@example.com");
    const created = await request(app)
      .post("/api/v1/folder")
      .set("Cookie", cookie)
      .send({ name: "Work" });
    expect(created.status).toBe(201);

    const listed = await request(app).get("/api/v1/folder").set("Cookie", cookie);
    expect(listed.body.folders).toHaveLength(1);

    const renamed = await request(app)
      .patch(`/api/v1/folder/${created.body.folder.id}`)
      .set("Cookie", cookie)
      .send({ name: "Personal" });
    expect(renamed.status).toBe(200);

    const removed = await request(app)
      .delete(`/api/v1/folder/${created.body.folder.id}`)
      .set("Cookie", cookie);
    expect(removed.status).toBe(200);
  });

  it("does not leak another users folder", async () => {
    const owner = await newUser("f-owner@example.com");
    const other = await newUser("f-other@example.com");
    const created = await request(app)
      .post("/api/v1/folder")
      .set("Cookie", owner.cookie)
      .send({ name: "Private" });

    const listed = await request(app).get("/api/v1/folder").set("Cookie", other.cookie);
    expect(listed.body.folders).toHaveLength(0);

    const renamed = await request(app)
      .patch(`/api/v1/folder/${created.body.folder.id}`)
      .set("Cookie", other.cookie)
      .send({ name: "Stolen" });
    expect(renamed.status).toBe(404);
  });

  it("rejects an empty folder name", async () => {
    const { cookie } = await newUser("f-empty@example.com");
    const response = await request(app).post("/api/v1/folder").set("Cookie", cookie).send({ name: "  " });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/v1/zap/:id/secret/rotate", () => {
  it("issues a new secret and records the rotation", async () => {
    const { cookie } = await newUser("rotate@example.com");
    const { triggerId, actionId } = await seededIds();
    const created = await request(app)
      .post("/api/v1/zap")
      .set("Cookie", cookie)
      .send({
        availableTriggerId: triggerId,
        triggerMetadata: {},
        actions: [{ availableActionId: actionId, actionMetadata: {} }],
      });

    const rotated = await request(app)
      .post(`/api/v1/zap/${created.body.zapId}/secret/rotate`)
      .set("Cookie", cookie);
    expect(rotated.status).toBe(200);
    expect(rotated.body.secret).not.toBe(created.body.secret);

    const stored = await prisma.webhookSecret.findUnique({ where: { zapId: created.body.zapId } });
    expect(stored!.rotatedAt).not.toBeNull();
  });
});
