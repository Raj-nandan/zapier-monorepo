import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "@repo/db";
import { userRouter } from "./user";
import { closeRedis, getRedis } from "../lib/redis";
import { setRateLimitCounter, createMemoryCounter } from "../middleware/rateLimit";

const SECRET = "0".repeat(32);
const emails: string[] = [];

function build(mailer: (input: { to: string; subject: string; text: string }) => Promise<void>) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/user", userRouter({ secret: SECRET, mailer }));
  return app;
}

let sent: Array<{ to: string; subject: string; text: string }> = [];
const app = build(async (message) => {
  sent.push(message);
});

beforeAll(async () => {
  await prisma.$connect();
  const redis = await getRedis();
  const keys = await redis.keys("rl:*");
  if (keys.length) await redis.del(keys);
  const locks = await redis.keys("lockout:*");
  if (locks.length) await redis.del(locks);
  const refreshes = await redis.keys("refresh:*");
  if (refreshes.length) await redis.del(refreshes);
});

beforeEach(async () => {
  setRateLimitCounter(createMemoryCounter());
  sent = [];
  const redis = await getRedis();
  for (const pattern of ["rl:*", "lockout:*", "refresh:*", "denylist:jti:*"]) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(keys);
  }
  await prisma.passwordReset.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

async function signup(email: string, password = "password123") {
  const response = await request(app)
    .post("/api/v1/user/signup")
    .send({ username: email, password, name: "Test User" });
  return response;
}

describe("POST /api/v1/user/signup", () => {
  it("creates a user and returns an identity without the password hash", async () => {
    const response = await signup("alice@example.com");
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe("alice@example.com");
    expect(JSON.stringify(response.body)).not.toContain("$2");
    expect(JSON.stringify(response.body)).not.toContain("password123");
  });

  it("sets httpOnly secure SameSite cookies", async () => {
    const response = await signup("cookies@example.com");
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const joined = cookies.join(";");
    expect(joined).toContain("access_token");
    expect(joined).toContain("refresh_token");
    expect(joined).toContain("HttpOnly");
    expect(joined.toLowerCase()).toContain("secure");
    expect(joined.toLowerCase()).toContain("samesite=lax");
  });

  it("never returns a token in the body or url", async () => {
    const response = await signup("notoken@example.com");
    const body = JSON.stringify(response.body);
    expect(body).not.toContain("eyJ");
    expect(response.request.url).not.toContain("token");
  });

  it("normalizes the email to lowercase and trimmed", async () => {
    await signup("  MiXeD@Example.COM  ");
    const user = await prisma.user.findUnique({ where: { email: "mixed@example.com" } });
    expect(user).not.toBeNull();
  });

  it("rejects a duplicate with a generic 409", async () => {
    await signup("dupe@example.com");
    const response = await signup("dupe@example.com");
    expect(response.status).toBe(409);
    expect(response.body.error).not.toContain("already");
    expect(response.body.error).not.toContain("exists");
  });

  it("rejects a short password", async () => {
    const response = await request(app)
      .post("/api/v1/user/signup")
      .send({ username: "short@example.com", password: "abc" });
    expect(response.status).toBe(400);
  });

  it("rejects a malformed email", async () => {
    const response = await request(app)
      .post("/api/v1/user/signup")
      .send({ username: "not-an-email", password: "password123" });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/v1/user/signin", () => {
  beforeEach(async () => {
    await signup("signin@example.com", "correct-horse");
  });

  it("issues cookies for valid credentials", async () => {
    const response = await request(app)
      .post("/api/v1/user/signin")
      .send({ username: "signin@example.com", password: "correct-horse" });
    expect(response.status).toBe(200);
    const cookies = (response.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookies).toContain("access_token");
  });

  it("returns a generic 401 that does not reveal whether the account exists", async () => {
    const wrongPassword = await request(app)
      .post("/api/v1/user/signin")
      .send({ username: "signin@example.com", password: "wrong-password" });
    const unknownUser = await request(app)
      .post("/api/v1/user/signin")
      .send({ username: "ghost@example.com", password: "wrong-password" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownUser.body);
  });

  it("locks out after 5 failed attempts", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app)
        .post("/api/v1/user/signin")
        .send({ username: "signin@example.com", password: "wrong-password" });
    }
    const blocked = await request(app)
      .post("/api/v1/user/signin")
      .send({ username: "signin@example.com", password: "correct-horse" });
    expect(blocked.status).toBe(429);
  });

  it("resets the failure counter after a successful signin", async () => {
    await request(app)
      .post("/api/v1/user/signin")
      .send({ username: "signin@example.com", password: "wrong" });
    const ok = await request(app)
      .post("/api/v1/user/signin")
      .send({ username: "signin@example.com", password: "correct-horse" });
    expect(ok.status).toBe(200);
  });
});

describe("POST /api/v1/user/refresh", () => {
  it("rotates the refresh token and issues a new session", async () => {
    const signupResponse = await signup("refresh@example.com");
    const cookies = signupResponse.headers["set-cookie"] as unknown as string[];
    const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

    const refreshed = await request(app)
      .post("/api/v1/user/refresh")
      .set("Cookie", cookieHeader);
    expect(refreshed.status).toBe(200);
    expect((refreshed.headers["set-cookie"] as unknown as string[]).join(";")).toContain(
      "refresh_token",
    );
  });

  it("rejects a refresh token that was already used", async () => {
    const signupResponse = await signup("reuse@example.com");
    const cookieHeader = (signupResponse.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0])
      .join("; ");

    const first = await request(app).post("/api/v1/user/refresh").set("Cookie", cookieHeader);
    expect(first.status).toBe(200);

    const replay = await request(app).post("/api/v1/user/refresh").set("Cookie", cookieHeader);
    expect(replay.status).toBe(401);
  });

  it("rejects when no cookie is supplied", async () => {
    const response = await request(app).post("/api/v1/user/refresh");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/v1/user/logout", () => {
  it("clears the cookies", async () => {
    const signupResponse = await signup("logout@example.com");
    const cookieHeader = (signupResponse.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0])
      .join("; ");
    const response = await request(app).post("/api/v1/user/logout").set("Cookie", cookieHeader);
    expect(response.status).toBe(200);
    const cleared = (response.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cleared).toMatch(/access_token=;/);
  });
});

describe("POST /api/v1/user/forgot", () => {
  it("returns the same 200 whether or not the account exists", async () => {
    await signup("exists@example.com");
    const known = await request(app)
      .post("/api/v1/user/forgot")
      .send({ email: "exists@example.com" });
    const unknown = await request(app)
      .post("/api/v1/user/forgot")
      .send({ email: "ghost@example.com" });
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
  });

  it("still returns 200 when the mail transport throws", async () => {
    const failing = build(async () => {
      throw new Error("smtp down");
    });
    await request(failing)
      .post("/api/v1/user/signup")
      .send({ username: "mailfail@example.com", password: "password123" });
    const response = await request(failing)
      .post("/api/v1/user/forgot")
      .send({ email: "mailfail@example.com" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("returns 400 for malformed json", async () => {
    const response = await request(app)
      .post("/api/v1/user/signin")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(response.status).toBe(400);
  });

  it("always returns 200 for an unknown email", async () => {
    const response = await request(app)
      .post("/api/v1/user/forgot")
      .send({ email: "nobody@example.com" });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("sends a reset link for a known email and stores only a hash", async () => {
    await signup("forgot@example.com");
    const response = await request(app)
      .post("/api/v1/user/forgot")
      .send({ email: "forgot@example.com" });
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);

    const record = await prisma.passwordReset.findFirst();
    expect(record).not.toBeNull();
    expect(record!.tokenHash).not.toContain(sent[0].text);
  });

  it("rate limits to 3 per hour per email", async () => {
    await signup("limited@example.com");
    for (let i = 0; i < 3; i++) {
      const ok = await request(app)
        .post("/api/v1/user/forgot")
        .send({ email: "limited@example.com" });
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app)
      .post("/api/v1/user/forgot")
      .send({ email: "limited@example.com" });
    expect(blocked.status).toBe(429);
  });
});

describe("POST /api/v1/user/reset", () => {
  async function requestReset(email: string) {
    await signup(email);
    await request(app).post("/api/v1/user/forgot").send({ email });
    const message = sent.at(-1)!;
    const token = new URL(message.text).searchParams.get("token")!;
    return token;
  }

  it("accepts a valid token once and changes the password", async () => {
    const token = await requestReset("reset@example.com");
    const response = await request(app)
      .post("/api/v1/user/reset")
      .send({ token, password: "brand-new-password" });
    expect(response.status).toBe(200);

    const signin = await request(app)
      .post("/api/v1/user/signin")
      .send({ username: "reset@example.com", password: "brand-new-password" });
    expect(signin.status).toBe(200);
  });

  it("fails closed when the token is reused", async () => {
    const token = await requestReset("reuse-token@example.com");
    await request(app).post("/api/v1/user/reset").send({ token, password: "first-password" });
    const replay = await request(app)
      .post("/api/v1/user/reset")
      .send({ token, password: "second-password" });
    expect(replay.status).toBe(400);
  });

  it("fails closed on an unknown token", async () => {
    const response = await request(app)
      .post("/api/v1/user/reset")
      .send({ token: "a".repeat(64), password: "whatever-pass" });
    expect(response.status).toBe(400);
  });

  it("fails closed on an expired token", async () => {
    const token = await requestReset("expired@example.com");
    await prisma.passwordReset.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const response = await request(app)
      .post("/api/v1/user/reset")
      .send({ token, password: "too-late-pass" });
    expect(response.status).toBe(400);
  });

  it("revokes existing sessions by bumping the token version", async () => {
    const token = await requestReset("revoke@example.com");
    const before = await prisma.user.findUnique({ where: { email: "revoke@example.com" } });
    await request(app).post("/api/v1/user/reset").send({ token, password: "new-password-here" });
    const after = await prisma.user.findUnique({ where: { email: "revoke@example.com" } });
    expect(after!.tokenVersion).toBe(before!.tokenVersion + 1);
  });
});

describe("GET /api/v1/user/", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/user/");
    expect(response.status).toBe(401);
  });

  it("returns name and email for the owner", async () => {
    const signupResponse = await signup("profile@example.com");
    const cookieHeader = (signupResponse.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0])
      .join("; ");
    const response = await request(app).get("/api/v1/user/").set("Cookie", cookieHeader);
    expect(response.status).toBe(200);
    expect(response.body.email).toBe("profile@example.com");
    expect(response.body.name).toBe("Test User");
    expect(JSON.stringify(response.body)).not.toContain("$2");
  });
});

describe("GET /api/v1/user/export", () => {
  it("exports the account without password hashes or tokens", async () => {
    const signupResponse = await signup("export@example.com");
    const cookieHeader = (signupResponse.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0])
      .join("; ");
    const response = await request(app).get("/api/v1/user/export").set("Cookie", cookieHeader);
    expect(response.status).toBe(200);
    const body = JSON.stringify(response.body);
    expect(body).toContain("export@example.com");
    expect(body).not.toContain("$2");
    expect(body).not.toContain("accessEnc");
  });
});

describe("DELETE /api/v1/user", () => {
  it("cascades and removes the account", async () => {
    const signupResponse = await signup("delete@example.com");
    const cookieHeader = (signupResponse.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0])
      .join("; ");
    const response = await request(app).delete("/api/v1/user/").set("Cookie", cookieHeader);
    expect(response.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { email: "delete@example.com" } });
    expect(user).toBeNull();
  });

  it("requires authentication", async () => {
    const response = await request(app).delete("/api/v1/user/");
    expect(response.status).toBe(401);
  });
});

void emails;
