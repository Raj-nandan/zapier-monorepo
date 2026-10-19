import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./index";
import { closeRedis } from "./lib/redis";

const app = createApp();

afterAll(async () => {
  await closeRedis();
});

describe("GET /healthz", () => {
  it("returns 200 without touching dependencies", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("GET /readyz", () => {
  it("reports database and redis status", async () => {
    const response = await request(app).get("/readyz");
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty("database");
    expect(response.body).toHaveProperty("redis");
    expect(typeof response.body.database).toBe("boolean");
    expect(typeof response.body.redis).toBe("boolean");
  });
});

describe("security headers", () => {
  it("sets helmet headers and hides the framework", async () => {
    const response = await request(app).get("/healthz");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toBeDefined();
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("cors allowlist", () => {
  it("allows only the configured web origin with credentials", async () => {
    const response = await request(app).get("/healthz").set("Origin", "http://localhost:3000");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("answers preflight with 204", async () => {
    const response = await request(app)
      .options("/api/v1/zap")
      .set("Origin", "http://localhost:3000");
    expect(response.status).toBe(204);
  });
});

describe("request id propagation", () => {
  it("echoes an inbound x-request-id", async () => {
    const response = await request(app).get("/healthz").set("X-Request-Id", "req-abc-123");
    expect(response.headers["x-request-id"]).toBe("req-abc-123");
  });

  it("generates one when absent", async () => {
    const response = await request(app).get("/healthz");
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("unknown routes", () => {
  it("returns a json 404 without leaking a stack trace", async () => {
    const response = await request(app).get("/definitely-not-a-route");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not found" });
  });
});
