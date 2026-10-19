import { describe, expect, it, vi } from "vitest";
import { getHandler, listHandlers, registry } from "./index";
import * as delay from "./delay";
import * as filter from "./filter";
import * as slack from "./slack";
import * as discord from "./discord";
import * as email from "./email";
import * as httpRequest from "./http-request";
import { MAX_RESPONSE_BYTES, SsrfError } from "./lib/ssrf";

const publicResolver = async () => ["93.184.216.34"];

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

describe("registry wiring", () => {
  it("registers all six seeded action slugs", () => {
    const slugs = listHandlers(registry)
      .map((h) => h.slug)
      .sort();
    expect(slugs).toEqual([
      "delay",
      "discord",
      "email",
      "filter",
      "http-request",
      "slack",
    ]);
  });

  it("exposes fields for every action", () => {
    expect(getHandler(registry, "delay").fields.map((f) => f.key)).toEqual(["ms"]);
    expect(getHandler(registry, "filter").fields.map((f) => f.key)).toEqual(["condition"]);
    expect(getHandler(registry, "http-request").fields.map((f) => f.key)).toEqual([
      "url",
      "method",
      "headers",
      "bodyTemplate",
    ]);
  });
});

describe("delay suspends without sleeping", () => {
  const now = new Date("2026-03-01T10:00:00.000Z");

  it("returns a suspend outcome with resumeAt", async () => {
    const outcome = await delay.run({ metadata: { ms: 60000 }, now });
    expect(outcome).toEqual({ kind: "suspend", resumeAt: new Date("2026-03-01T10:01:00.000Z") });
  });

  it("resolves immediately rather than awaiting", async () => {
    const started = Date.now();
    await delay.run({ metadata: { ms: 60000 }, now });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("rejects a non positive delay", async () => {
    await expect(delay.run({ metadata: { ms: 0 }, now })).rejects.toThrow(/positive integer/);
    await expect(delay.run({ metadata: { ms: -5 }, now })).rejects.toThrow(/positive integer/);
  });

  it("caps the delay window", async () => {
    await expect(delay.run({ metadata: { ms: delay.MAX_DELAY_MS + 1 }, now })).rejects.toThrow(
      /exceeds/,
    );
  });
});

describe("filter skips the rest of the chain", () => {
  const context = { trigger: { output: { count: 5, name: "a", tags: ["x", "y"] } } };

  it("passes when the condition holds", async () => {
    const outcome = await filter.run({
      metadata: { condition: "trigger.output.count > 3" },
      context,
    });
    expect(outcome.kind).toBe("success");
  });

  it("skips with a reason when the condition fails", async () => {
    const outcome = await filter.run({
      metadata: { condition: "trigger.output.count > 10" },
      context,
    });
    expect(outcome.kind).toBe("skip");
    if (outcome.kind === "skip") {
      expect(outcome.reason).toMatch(/condition not met/);
    }
  });

  it("supports string equality and contains", async () => {
    expect(
      (await filter.run({ metadata: { condition: "trigger.output.name == a" }, context })).kind,
    ).toBe("success");
    expect(
      (await filter.run({ metadata: { condition: 'trigger.output.name == "b"' }, context })).kind,
    ).toBe("skip");
    expect(
      (await filter.run({ metadata: { condition: "trigger.output.name contains z" }, context }))
        .kind,
    ).toBe("skip");
  });

  it("compares numerically rather than lexically", () => {
    const parsed = filter.parseCondition("trigger.output.count > 3");
    expect(filter.evaluate(parsed, { trigger: { output: { count: 10 } } })).toBe(true);
    expect(filter.evaluate(parsed, { trigger: { output: { count: 2 } } })).toBe(false);
  });

  it("treats a missing path as unmatched", async () => {
    const outcome = await filter.run({
      metadata: { condition: "trigger.output.missing == x" },
      context,
    });
    expect(outcome.kind).toBe("skip");
  });

  it("rejects an unsupported condition instead of guessing", async () => {
    await expect(
      filter.run({ metadata: { condition: "process.exit(1)" }, context }),
    ).rejects.toThrow(filter.FilterError);
    await expect(filter.run({ metadata: { condition: "" }, context })).rejects.toThrow(
      filter.FilterError,
    );
  });

  it("never evaluates arbitrary code", async () => {
    const globals = globalThis as Record<string, unknown>;
    globals.__pwned = false;
    await filter
      .run({ metadata: { condition: "__pwned == true" }, context: {} })
      .catch(() => undefined);
    expect(globals.__pwned).toBe(false);
    delete globals.__pwned;
  });
});

describe("slack delivery", () => {
  it("posts to chat.postMessage with a bearer token", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const outcome = await slack.run({
      metadata: { to: "#general", body: "hello" },
      token: "xoxb-test",
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({ method: "POST" }),
    );
    expect(outcome.kind).toBe("success");
  });

  it("raises when slack rejects the message", async () => {
    await expect(
      slack.run({
        metadata: { to: "#general", body: "hi" },
        token: "xoxb-test",
        fetchImpl: async () => jsonResponse({ ok: false, error: "channel_not_found" }),
      }),
    ).rejects.toThrow(/channel_not_found/);
  });

  it("raises without a token", async () => {
    await expect(
      slack.run({ metadata: { to: "#x", body: "y" }, token: "", fetchImpl: async () => jsonResponse({}) }),
    ).rejects.toThrow(/token is not configured/);
  });
});

describe("discord delivery", () => {
  it("posts content to the webhook url", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const outcome = await discord.run({
      metadata: { url: "https://discord.com/api/webhooks/x", body: "hi" },
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/x",
      expect.objectContaining({ method: "POST" }),
    );
    expect(outcome.kind).toBe("success");
  });

  it("raises on a non 2xx webhook response", async () => {
    await expect(
      discord.run({
        metadata: { url: "https://discord.com/api/webhooks/x", body: "hi" },
        fetchImpl: async () => jsonResponse({}, false, 401),
      }),
    ).rejects.toThrow(/returned 401/);
  });
});

describe("http-request SSRF block", () => {
  it("refuses a request that resolves to the metadata ip", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await expect(
      httpRequest.run({
        metadata: { url: "https://evil.example.com/", method: "GET" },
        resolveHost: async () => ["169.254.169.254"],
        fetchImpl,
      }),
    ).rejects.toThrow(SsrfError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a loopback url outright", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await expect(
      httpRequest.run({
        metadata: { url: "http://127.0.0.1:8080/admin", method: "GET" },
        fetchImpl,
      }),
    ).rejects.toThrow(/address is blocked/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a non http protocol", async () => {
    await expect(
      httpRequest.run({
        metadata: { url: "file:///etc/passwd", method: "GET" },
        fetchImpl: async () => jsonResponse({}),
      }),
    ).rejects.toThrow(/protocol not allowed/);
  });

  it("allows a public host and returns parsed json", async () => {
    const outcome = await httpRequest.run({
      metadata: { url: "https://api.example.com/v1", method: "GET" },
      resolveHost: publicResolver,
      fetchImpl: async () => jsonResponse({ hello: "world" }),
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.output).toMatchObject({ status: 200, body: { hello: "world" } });
    }
  });

  it("caps the response body at 1MB", async () => {
    const huge = "x".repeat(MAX_RESPONSE_BYTES + 10);
    await expect(
      httpRequest.run({
        metadata: { url: "https://api.example.com/v1", method: "GET" },
        resolveHost: publicResolver,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => huge,
        }) as unknown as Response,
      }),
    ).rejects.toThrow(/exceeds/);
  });

  it("raises on a non 2xx response", async () => {
    await expect(
      httpRequest.run({
        metadata: { url: "https://api.example.com/v1", method: "GET" },
        resolveHost: publicResolver,
        fetchImpl: async () => jsonResponse({}, false, 500),
      }),
    ).rejects.toThrow(/failed with 500/);
  });

  it("never sends credentials to a blocked host", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await httpRequest
      .run({
        metadata: {
          url: "http://169.254.169.254/latest/meta-data/",
          method: "GET",
          headers: { authorization: "Bearer secret" },
        },
        fetchImpl,
      })
      .catch(() => undefined);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("email delivery", () => {
  it("sends through the injected transport", async () => {
    const sendMail = vi.fn(async () => ({ messageId: "m1" }));
    const outcome = await email.run({
      metadata: { to: "a@b.com", subject: "s", body: "b" },
      transport: { sendMail },
      from: "bot@example.com",
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "bot@example.com",
      to: "a@b.com",
      subject: "s",
      text: "b",
    });
    expect(outcome.kind).toBe("success");
  });

  it("raises when smtp is not configured", async () => {
    await expect(
      email.run({
        metadata: { to: "a@b.com", subject: "", body: "" },
        transport: { sendMail: async () => ({}) },
        from: "",
      }),
    ).rejects.toThrow(/no sender address/);
  });
});
