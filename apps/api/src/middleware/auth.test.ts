import { describe, expect, it } from "vitest";
import { createMemoryCounter, rateLimit, setRateLimitCounter } from "./rateLimit";
import {
  AuthError,
  assertOwned,
  currentUserId,
  extractRefreshCookie,
  extractToken,
} from "./auth";

function fakeReq(options: {
  authorization?: string;
  cookies?: Record<string, string>;
  ip?: string;
  auth?: { userId: string };
} = {}) {
  return {
    header: (name: string) =>
      name.toLowerCase() === "authorization" ? options.authorization : undefined,
    cookies: options.cookies ?? {},
    ip: options.ip ?? "127.0.0.1",
    auth: options.auth,
  } as never;
}

function fakeRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return { res, headers };
}

describe("token extraction", () => {
  it("reads a bearer header for api clients", () => {
    expect(extractToken(fakeReq({ authorization: "Bearer abc.def.ghi" }))).toBe(
      "abc.def.ghi",
    );
  });

  it("reads the access cookie for the web client", () => {
    expect(extractToken(fakeReq({ cookies: { access_token: "cookie-token" } }))).toBe(
      "cookie-token",
    );
  });

  it("prefers the bearer header when both are present", () => {
    expect(
      extractToken(
        fakeReq({ authorization: "Bearer header-token", cookies: { access_token: "cookie-token" } }),
      ),
    ).toBe("header-token");
  });

  it("is case insensitive on the scheme", () => {
    expect(extractToken(fakeReq({ authorization: "bearer lower" }))).toBe("lower");
  });

  it("returns null when nothing is present", () => {
    expect(extractToken(fakeReq())).toBeNull();
  });

  it("reads the refresh cookie separately from the access cookie", () => {
    expect(
      extractRefreshCookie(fakeReq({ cookies: { refresh_token: "r1", access_token: "a1" } })),
    ).toBe("r1");
  });
});

describe("ownership and IDOR guard", () => {
  const asUser = { userId: "userA" };

  it("allows the owner", () => {
    const req = fakeReq({ auth: asUser });
    expect(() => assertOwned(req, "userA")).not.toThrow();
  });

  it("hides another users resource behind 404 rather than 403", () => {
    const req = fakeReq({ auth: asUser });
    try {
      assertOwned(req, "userB");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).status).toBe(404);
      expect((error as AuthError).message).toBe("not found");
    }
  });

  it("rejects an unauthenticated request", () => {
    expect(() => assertOwned(fakeReq(), "userA")).toThrow(/authentication required/);
    expect(() => currentUserId(fakeReq())).toThrow(AuthError);
  });

  it("returns the current user id when authenticated", () => {
    expect(currentUserId(fakeReq({ auth: asUser }))).toBe("userA");
  });
});

describe("rate limiting", () => {
  it("counts within a window and blocks past the limit", async () => {
    const store = createMemoryCounter();
    setRateLimitCounter(store);
    const middleware = rateLimit({
      limit: 2,
      windowSeconds: 60,
      key: (req) => `ip:${req.ip}`,
    });

    const first = fakeRes();
    await middleware(fakeReq(), first.res as never, () => undefined);
    expect(first.res.statusCode).toBe(200);

    const second = fakeRes();
    await middleware(fakeReq(), second.res as never, () => undefined);
    expect(second.res.statusCode).toBe(200);
    expect(second.headers["X-RateLimit-Remaining"]).toBe("0");

    const third = fakeRes();
    await middleware(fakeReq(), third.res as never, () => undefined);
    expect(third.res.statusCode).toBe(429);
    expect(third.res.body).toEqual({ error: "too many requests" });
    expect(third.headers["Retry-After"]).toBe("60");
  });

  it("keeps separate buckets per key", async () => {
    const store = createMemoryCounter();
    setRateLimitCounter(store);
    const middleware = rateLimit({
      limit: 1,
      windowSeconds: 60,
      key: (req) => `ip:${req.ip}`,
    });

    const a1 = fakeRes();
    await middleware(fakeReq({ ip: "1.1.1.1" }), a1.res as never, () => undefined);
    expect(a1.res.statusCode).toBe(200);

    const b1 = fakeRes();
    await middleware(fakeReq({ ip: "2.2.2.2" }), b1.res as never, () => undefined);
    expect(b1.res.statusCode).toBe(200);

    const a2 = fakeRes();
    await middleware(fakeReq({ ip: "1.1.1.1" }), a2.res as never, () => undefined);
    expect(a2.res.statusCode).toBe(429);
  });

  it("exposes limit and remaining headers", async () => {
    const store = createMemoryCounter();
    setRateLimitCounter(store);
    const middleware = rateLimit({ limit: 5, windowSeconds: 30, key: () => "k" });
    const out = fakeRes();
    await middleware(fakeReq(), out.res as never, () => undefined);
    expect(out.headers["X-RateLimit-Limit"]).toBe("5");
    expect(out.headers["X-RateLimit-Remaining"]).toBe("4");
  });

  it("resets counters", async () => {
    const store = createMemoryCounter();
    await store.increment("k", 60);
    expect(await store.increment("k", 60)).toBe(2);
    store.reset();
    expect(await store.increment("k", 60)).toBe(1);
  });
});
