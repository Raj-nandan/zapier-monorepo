import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "@repo/db";
import { connectionsRouter } from "./connections";
import { closeRedis, getRedis } from "../lib/redis";
import { CONNECTION_STATE_PREFIX, decrypt, encrypt, resolveConnection } from "../lib/connections";
import { userRouter } from "./user";

const SECRET = "0".repeat(32);

function build(fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/user", userRouter({ secret: SECRET, mailer: async () => undefined }));
  app.use("/api/v1/connections", connectionsRouter({ secret: SECRET, fetchImpl, webUrl: "http://localhost:3000" }));
  return app;
}

function json(payload: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => payload, text: async () => JSON.stringify(payload) } as unknown as Response;
}

const tokenFetch = async () => json({ access_token: "conn-token", refresh_token: "conn-refresh", expires_in: 3600, scope: "repo" });

function flip(segment: string): string {
  return segment[0] === "Z" ? `Y${segment.slice(1)}` : `Z${segment.slice(1)}`;
}

async function signUp(app: ReturnType<typeof build>, email: string) {
  await request(app).post("/api/v1/user/signup").send({ username: email, password: "password123" });
  const user = await prisma.user.findUnique({ where: { email } });
  const cookie = (await request(app).post("/api/v1/user/signin").send({ username: email, password: "password123" }));
  const jar = (cookie.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
  return { cookie: jar, userId: user!.id };
}

beforeEach(async () => {
  const redis = await getRedis();
  for (const pattern of ["oauth:connection:*", "oauth:state:*", "rl:*", "lockout:*", "refresh:*", "denylist:jti:*"]) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(keys);
  }
  await prisma.connectedAccount.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

async function start(app: ReturnType<typeof build>, cookie: string, appName: "gmail" | "github") {
  const response = await request(app).post(`/api/v1/connections/${appName}`).set("Cookie", cookie);
  return new URL(response.body.authorizeUrl).searchParams.get("state")!;
}

describe("token encryption", () => {
  it("round-trips through encrypt/decrypt", () => {
    const cipher = encrypt("super-secret-token");
    expect(cipher).not.toContain("super-secret-token");
    expect(decrypt(cipher)).toBe("super-secret-token");
  });

  it("produces a different ciphertext each time", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("rejects a tampered ciphertext", () => {
    const [iv, tag, data] = encrypt("value").split(".");
    const flipped = flip(data!);
    expect(flipped).not.toBe(data);
    expect(() => decrypt(`${iv}.${tag}.${flipped}`)).toThrow();
  });

  it("rejects a modified authentication tag", () => {
    const [iv, tag, data] = encrypt("value").split(".");
    const flippedTag = flip(tag!);
    expect(flippedTag).not.toBe(tag);
    expect(() => decrypt(`${iv}.${flippedTag}.${data}`)).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decrypt("not-encrypted")).toThrow(/malformed/);
  });
});

describe("POST /api/v1/connections/:app", () => {
  it("returns an authorize url with state and PKCE challenge", async () => {
    const app = build();
    const { cookie } = await signUp(app, "conn@example.com");
    const response = await request(app).post("/api/v1/connections/github").set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.authorizeUrl).toContain("github.com/login/oauth/authorize");
    expect(response.body.authorizeUrl).toContain("code_challenge_method=S256");
  });

  it("stores state bound to the user with a 10 minute ttl", async () => {
    const app = build();
    const { cookie, userId } = await signUp(app, "conn-state@example.com");
    const response = await request(app).post("/api/v1/connections/gmail").set("Cookie", cookie);
    const state = new URL(response.body.authorizeUrl).searchParams.get("state")!;

    const redis = await getRedis();
    const stored = await redis.get(`${CONNECTION_STATE_PREFIX}${state}`);
    expect(JSON.parse(stored!).userId).toBe(userId);
    const ttl = await redis.ttl(`${CONNECTION_STATE_PREFIX}${state}`);
    expect(ttl).toBeGreaterThan(500);
    expect(ttl).toBeLessThanOrEqual(600);
  });

  it("rejects an unknown app", async () => {
    const app = build();
    const { cookie } = await signUp(app, "conn-bad@example.com");
    expect((await request(app).post("/api/v1/connections/dropbox").set("Cookie", cookie)).status).toBe(404);
  });

  it("requires authentication", async () => {
    const app = build();
    expect((await request(app).post("/api/v1/connections/github")).status).toBe(401);
  });
});

describe("GET /api/v1/connections/callback/:app", () => {
  it("upserts a ConnectedAccount with encrypted tokens", async () => {
    const app = build(tokenFetch);
    const { cookie, userId } = await signUp(app, "cb@example.com");
    const state = await start(app, cookie, "github");

    const response = await request(app).get(`/api/v1/connections/callback/github?code=abc&state=${state}`);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/settings");

    const row = await prisma.connectedAccount.findFirst({ where: { userId } });
    expect(row).not.toBeNull();
    expect(row!.accessEnc).not.toContain("conn-token");
    expect(row!.scope).toBe("repo");
  });

  it("never returns tokens to the client", async () => {
    const app = build(tokenFetch);
    const { cookie } = await signUp(app, "cb-leak@example.com");
    const state = await start(app, cookie, "github");
    const response = await request(app).get(`/api/v1/connections/callback/github?code=abc&state=${state}`);
    const raw = JSON.stringify(response.body ?? {}) + (response.headers.location ?? "");
    expect(raw).not.toContain("conn-token");
    expect(raw).not.toContain("conn-refresh");
  });

  it("rejects an unknown state", async () => {
    const app = build(tokenFetch);
    await signUp(app, "cb-bad@example.com");
    const response = await request(app).get("/api/v1/connections/callback/github?code=abc&state=never");
    expect(response.status).toBe(401);
  });

  it("rejects a state issued for the other app", async () => {
    const app = build(tokenFetch);
    const { cookie } = await signUp(app, "cb-cross@example.com");
    const state = await start(app, cookie, "gmail");
    const response = await request(app).get(`/api/v1/connections/callback/github?code=abc&state=${state}`);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("state app mismatch");
  });

  it("does not expose accessEnc in the list", async () => {
    const app = build(tokenFetch);
    const { cookie } = await signUp(app, "cb-list@example.com");
    const state = await start(app, cookie, "github");
    await request(app).get(`/api/v1/connections/callback/github?code=abc&state=${state}`);

    const list = await request(app).get("/api/v1/connections/").set("Cookie", cookie);
    expect(list.status).toBe(200);
    const body = JSON.stringify(list.body);
    expect(body).toContain("github");
    expect(body).not.toContain("accessEnc");
    expect(body).not.toContain("refreshEnc");
  });
});

describe("DELETE /api/v1/connections/:id", () => {
  it("disconnects and is owner scoped", async () => {
    const app = build(tokenFetch);
    const owner = await signUp(app, "del-owner@example.com");
    const state = await start(app, owner.cookie, "github");
    await request(app).get(`/api/v1/connections/callback/github?code=abc&state=${state}`);
    const row = await prisma.connectedAccount.findFirstOrThrow();

    const other = await signUp(app, "del-other@example.com");
    expect((await request(app).delete(`/api/v1/connections/${row!.id}`).set("Cookie", other.cookie)).status).toBe(404);

    const removed = await request(app).delete(`/api/v1/connections/${row!.id}`).set("Cookie", owner.cookie);
    expect(removed.status).toBe(200);
    expect(await prisma.connectedAccount.count()).toBe(0);
  });
});

describe("resolveConnection", () => {
  it("decrypts server side and never returns ciphertext", async () => {
    const app = build();
    const { userId } = await signUp(app, "resolve@example.com");
    const row = await prisma.connectedAccount.create({
      data: { userId, app: "github", accessEnc: encrypt("live-token"), scope: "repo" },
    });

    const resolved = await resolveConnection(row!.id, userId);
    expect(resolved!.accessToken).toBe("live-token");
    expect(JSON.stringify(resolved)).not.toContain(row.accessEnc);
  });

  it("refreshes when the token expires within 5 minutes", async () => {
    const app = build();
    const { userId } = await signUp(app, "refresh@example.com");
    const row = await prisma.connectedAccount.create({
      data: {
        userId,
        app: "github",
        accessEnc: encrypt("old-token"),
        refreshEnc: encrypt("refresh-token"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const refreshedFetch = async (input: string, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("grant_type")).toBe("refresh_token");
      return json({ access_token: "fresh-token", expires_in: 3600 });
    };

    const resolved = await resolveConnection(row!.id, userId, refreshedFetch);
    expect(resolved!.accessToken).toBe("fresh-token");

    const stored = await prisma.connectedAccount.findUniqueOrThrow({ where: { id: row!.id } });
    expect(stored.accessEnc).not.toContain("fresh-token");
    expect(decrypt(stored.accessEnc!)).toBe("fresh-token");
  });

  it("does not refresh when plenty of time remains", async () => {
    const app = build();
    const { userId } = await signUp(app, "norefresh@example.com");
    const row = await prisma.connectedAccount.create({
      data: {
        userId,
        app: "github",
        accessEnc: encrypt("still-good"),
        refreshEnc: encrypt("refresh-token"),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const resolved = await resolveConnection(row!.id, userId, async () => {
      throw new Error("should not refresh");
    });
    expect(resolved!.accessToken).toBe("still-good");
  });

  it("returns null for another users connection", async () => {
    const app = build();
    const owner = await signUp(app, "own@example.com");
    const row = await prisma.connectedAccount.create({
      data: { userId: owner.userId, app: "gmail", accessEnc: encrypt("t") },
    });
    const other = await signUp(app, "stranger@example.com");
    expect(await resolveConnection(row!.id, other.userId)).toBeNull();
  });
});
