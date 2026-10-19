import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "@repo/db";
import { authRouter } from "./auth";
import { closeRedis, getRedis } from "../lib/redis";
import { STATE_PREFIX } from "./auth";
import { OAuthError, pkceChallenge, safeEqual } from "../lib/oauth";

const SECRET = "0".repeat(32);

function build(fetchImpl: (input: string, init?: RequestInit) => Promise<Response>) {
  const app = express();
  app.use(cookieParser());
  app.use("/api/v1/auth", authRouter({ secret: SECRET, fetchImpl, dashboardUrl: "http://localhost:3000/dashboard" }));
  return app;
}

function json(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

function fakeFetch(options: { profile?: Record<string, unknown>; emails?: unknown; token?: Record<string, unknown> } = {}) {
  return async (input: string) => {
    if (input.includes("/token") || input.includes("access_token")) {
      return json(options.token ?? { access_token: "provider-token", expires_in: 3600 });
    }
    if (input.includes("/user/emails")) {
      return json(options.emails ?? [{ email: "oauth@example.com", primary: true, verified: true }]);
    }
    return json(options.profile ?? { sub: "google-123", email: "oauth@example.com", email_verified: true, name: "OAuth User" });
  };
}

beforeEach(async () => {
  const redis = await getRedis();
  for (const pattern of ["oauth:state:*", "rl:*", "lockout:*", "refresh:*", "denylist:jti:*"]) {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(keys);
  }
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

async function startFlow(app: ReturnType<typeof build>, provider: "google" | "github") {
  const response = await request(app).get(`/api/v1/auth/${provider}`);
  const location = new URL(response.headers.location);
  return { state: location.searchParams.get("state")!, location: response.headers.location };
}

describe("authorize redirect", () => {
  it("redirects to google with state and S256 challenge, no token in url", async () => {
    const app = build(fakeFetch());
    const response = await request(app).get("/api/v1/auth/google");
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("accounts.google.com");
    const url = new URL(response.headers.location);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(response.headers.location).not.toContain("access_token");
  });

  it("stores state with a 10 minute ttl", async () => {
    const app = build(fakeFetch());
    const { state } = await startFlow(app, "google");
    const redis = await getRedis();
    const stored = await redis.get(`${STATE_PREFIX}${state}`);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!).provider).toBe("google");
    const ttl = await redis.ttl(`${STATE_PREFIX}${state}`);
    expect(ttl).toBeGreaterThan(500);
    expect(ttl).toBeLessThanOrEqual(600);
  });

  it("redirects to github for the github provider", async () => {
    const app = build(fakeFetch());
    const response = await request(app).get("/api/v1/auth/github");
    expect(response.headers.location).toContain("github.com/login/oauth/authorize");
  });
});

describe("callback failure modes fail closed", () => {
  it("rejects an unknown state with 401", async () => {
    const app = build(fakeFetch());
    const response = await request(app).get("/api/v1/auth/callback/google?code=abc&state=never-issued");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("invalid or expired state");
  });

  it("rejects a state that was already used", async () => {
    const app = build(fakeFetch());
    const { state } = await startFlow(app, "google");
    const first = await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    expect(first.status).toBe(302);
    const replay = await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    expect(replay.status).toBe(401);
  });

  it("rejects a state issued for the other provider", async () => {
    const app = build(fakeFetch());
    const { state } = await startFlow(app, "google");
    const response = await request(app).get(`/api/v1/auth/callback/github?code=abc&state=${state}`);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("state provider mismatch");
  });

  it("rejects a callback without code", async () => {
    const app = build(fakeFetch());
    const { state } = await startFlow(app, "google");
    const response = await request(app).get(`/api/v1/auth/callback/google?state=${state}`);
    expect(response.status).toBe(400);
  });

  it("rejects an unverified google email", async () => {
    const app = build(fakeFetch({ profile: { sub: "g1", email: "unverified@example.com", email_verified: false } }));
    const { state } = await startFlow(app, "google");
    const response = await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    expect(response.status).toBe(401);
  });

  it("rejects when the token exchange fails", async () => {
    const app = build(fakeFetch({ token: { error: "invalid_grant" } as Record<string, unknown> }));
    const { state } = await startFlow(app, "google");
    const response = await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    expect(response.status).toBe(401);
  });
});

describe("account linking", () => {
  it("creates User and Account on first login", async () => {
    const app = build(fakeFetch());
    const { state } = await startFlow(app, "google");
    const response = await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("http://localhost:3000/dashboard");

    const user = await prisma.user.findUnique({ where: { email: "oauth@example.com" } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBeNull();
    const account = await prisma.account.findFirst({ where: { userId: user!.id } });
    expect(account?.provider).toBe("google");
    expect(account?.providerAccountId).toBe("google-123");
  });

  it("reuses the same user on re-login", async () => {
    const app = build(fakeFetch());
    let { state } = await startFlow(app, "google");
    await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    ({ state } = await startFlow(app, "google"));
    await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.account.count()).toBe(1);
  });

  it("links two providers with the same verified email to one user", async () => {
    const google = build(fakeFetch());
    let { state } = await startFlow(google, "google");
    await request(google).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);

    const github = build(
      fakeFetch({
        profile: { id: 999, login: "octocat", name: "Octo" },
        emails: [{ email: "oauth@example.com", primary: true, verified: true }],
      }),
    );
    ({ state } = await startFlow(github, "github"));
    const response = await request(github).get(`/api/v1/auth/callback/github?code=abc&state=${state}`);

    expect(response.status).toBe(302);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.account.count()).toBe(2);
  });

  it("encrypts the provider access token at rest", async () => {
    const app = build(fakeFetch());
    const { state } = await startFlow(app, "google");
    await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    const account = await prisma.account.findFirst();
    expect(account!.accessTokenEnc).toBeTruthy();
    expect(account!.accessTokenEnc).not.toContain("provider-token");
  });

  it("issues httpOnly session cookies and no token in the redirect", async () => {
    const app = build(fakeFetch());
    const { state } = await startFlow(app, "google");
    const response = await request(app).get(`/api/v1/auth/callback/google?code=abc&state=${state}`);
    const cookies = (response.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookies).toContain("access_token");
    expect(cookies).toContain("HttpOnly");
    expect(response.headers.location).not.toContain("token");
  });
});

describe("helpers", () => {
  it("pkce challenge is a stable sha256 of the verifier", () => {
    expect(pkceChallenge("verifier")).toBe(pkceChallenge("verifier"));
    expect(pkceChallenge("verifier")).not.toBe(pkceChallenge("other"));
    expect(pkceChallenge("verifier")).not.toContain("verifier");
  });

  it("safeEqual compares in constant time and rejects length mismatch", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("OAuthError carries a reason and status", () => {
    const error = new OAuthError("invalid or expired state");
    expect(error.status).toBe(401);
  });
});
