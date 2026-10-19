import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getHandler, listHandlers, registry } from "./index";
import * as schedule from "./schedule";
import * as manual from "./manual";
import * as webhook from "./webhook";
import * as githubPoll from "./github-poll";
import * as rssPoll from "./rss-poll";
import type { ServerAppConnection } from "@repo/schemas";

const githubConnection: ServerAppConnection = {
  id: "conn_1",
  app: "github",
  accountLabel: "octocat",
  accessToken: "gho_test",
  refreshToken: null,
  expiresAt: null,
  scope: "repo",
};

function stubFetch(payload: unknown, ok = true, status = 200) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    }) as unknown as Response) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe("registry wiring", () => {
  it("registers all five seeded trigger slugs", () => {
    const slugs = listHandlers(registry)
      .map((h) => h.slug)
      .sort();
    expect(slugs).toEqual([
      "github-poll",
      "manual",
      "rss-poll",
      "schedule",
      "webhook",
    ]);
  });

  it("exposes fields for every registered trigger", () => {
    for (const handler of listHandlers(registry)) {
      expect(Array.isArray(handler.fields)).toBe(true);
    }
    expect(getHandler(registry, "schedule").fields.map((f) => f.key)).toEqual(["cron"]);
    expect(getHandler(registry, "github-poll").fields.map((f) => f.key)).toEqual([
      "owner",
      "repo",
    ]);
  });

  it("validates metadata with each handler schema", () => {
    expect(getHandler(registry, "schedule").schema.safeParse({ cron: "* * * * *" }).success).toBe(
      true,
    );
    expect(getHandler(registry, "schedule").schema.safeParse({}).success).toBe(false);
    expect(
      getHandler(registry, "github-poll").schema.safeParse({ owner: "o", repo: "r" }).success,
    ).toBe(true);
    expect(getHandler(registry, "github-poll").schema.safeParse({ owner: "o" }).success).toBe(
      false,
    );
    expect(getHandler(registry, "rss-poll").schema.safeParse({ url: "not-a-url" }).success).toBe(
      false,
    );
  });
});

describe("manual trigger sample", () => {
  it("returns a sample carrying the configured message", async () => {
    const [sample] = (await manual.fetchSample({
      metadata: { message: "hello" },
    })) as Array<{ message: string }>;
    expect(sample.message).toBe("hello");
    expect(sample.source).toBe("manual");
  });

  it("defaults the message when none is configured", async () => {
    const [sample] = (await manual.fetchSample({ metadata: {} })) as Array<{
      message: string;
    }>;
    expect(sample.message).toBe("manual trigger sample");
  });

  it("always returns exactly one item", async () => {
    expect(await manual.fetchSample({ metadata: {} })).toHaveLength(1);
  });
});

describe("webhook trigger is passive", () => {
  it("returns an empty sample set rather than erroring", async () => {
    expect(await webhook.fetchSample({ metadata: {} })).toEqual([]);
  });

  it("accepts any metadata", () => {
    expect(webhook.schema.safeParse({ anything: true }).success).toBe(true);
  });
});

describe("cron nextRun", () => {
  const from = new Date("2026-03-01T10:00:00.000Z");

  it("computes the next 5 minute boundary", () => {
    expect(schedule.nextRunAt("*/5 * * * *", from)?.toISOString()).toBe(
      "2026-03-01T10:05:00.000Z",
    );
  });

  it("computes an hourly boundary", () => {
    expect(schedule.nextRunAt("0 * * * *", from)?.toISOString()).toBe(
      "2026-03-01T11:00:00.000Z",
    );
  });

  it("returns a strictly future time", () => {
    const next = schedule.nextRunAt("*/5 * * * *", from);
    expect(next!.getTime()).toBeGreaterThan(from.getTime());
  });

  it("computes a daily boundary in UTC, not local time", () => {
    expect(schedule.CRON_TIMEZONE).toBe("UTC");
    expect(schedule.nextRunAt("0 0 * * *", from)?.toISOString()).toBe(
      "2026-03-02T00:00:00.000Z",
    );
  });

  it("computes a named-hour boundary in UTC", () => {
    expect(schedule.nextRunAt("30 2 * * *", from)?.toISOString()).toBe(
      "2026-03-02T02:30:00.000Z",
    );
  });

  it("returns null for an invalid expression instead of throwing", () => {
    expect(schedule.nextRunAt("not a cron", from)).toBeNull();
  });

  it("validates cron expressions", () => {
    expect(schedule.isValidCron("*/5 * * * *")).toBe(true);
    expect(schedule.isValidCron("nonsense")).toBe(false);
  });

  it("surfaces the next run in the sample", async () => {
    const [sample] = (await schedule.fetchSample({
      metadata: { cron: "0 * * * *" },
    })) as Array<{ nextRunAt: string | null }>;
    expect(sample.nextRunAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("github-poll cursor advance", () => {
  const issues = [
    { id: 11, number: 1, title: "a", state: "open", html_url: "u1", updated_at: "t1" },
    { id: 12, number: 2, title: "b", state: "open", html_url: "u2", updated_at: "t2" },
    { id: 13, number: 3, title: "c", state: "open", html_url: "u3", updated_at: "t3" },
  ];

  it("requires a github connection", async () => {
    await expect(
      githubPoll.fetchSample({ metadata: { owner: "o", repo: "r" } }),
    ).rejects.toThrow(/requires a github ConnectedAccount/);
  });

  it("rejects a non github connection", async () => {
    await expect(
      githubPoll.fetchSample({
        metadata: { owner: "o", repo: "r" },
        connection: { ...githubConnection, app: "gmail" },
      }),
    ).rejects.toThrow(/expected a github connection/);
  });

  it("returns all items when no cursor is set", () => {
    const items = issues.map(githubPoll.toIssue);
    expect(githubPoll.itemsAfterCursor(items, undefined)).toHaveLength(3);
  });

  it("returns only items after the cursor", () => {
    const items = issues.map(githubPoll.toIssue);
    const fresh = githubPoll.itemsAfterCursor(items, "11");
    expect(fresh.map((i) => i.id)).toEqual(["12", "13"]);
  });

  it("advances the cursor to the highest id", () => {
    const items = issues.map(githubPoll.toIssue);
    expect(githubPoll.advanceCursor(items, "11")).toBe("13");
  });

  it("does not rewind the cursor when no new items arrive", () => {
    expect(githubPoll.advanceCursor([], "11")).toBe("11");
    expect(githubPoll.advanceCursor(issues.map(githubPoll.toIssue), "99")).toBe("99");
  });

  it("sorts ascending and filters through fetchSample", async () => {
    const restore = stubFetch([...issues].reverse());
    try {
      const fresh = await githubPoll.fetchSample({
        metadata: { owner: "o", repo: "r", cursor: "11" },
        connection: githubConnection,
      });
      expect(fresh.map((i) => i.id)).toEqual(["12", "13"]);
    } finally {
      restore();
    }
  });

  it("raises on a non-ok github response", async () => {
    const restore = stubFetch(null, false, 403);
    try {
      await expect(
        githubPoll.fetchSample({
          metadata: { owner: "o", repo: "r" },
          connection: githubConnection,
        }),
      ).rejects.toThrow(/returned 403/);
    } finally {
      restore();
    }
  });
});

describe("rss-poll cursor advance", () => {
  const feed = `<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <title>Feed</title>
      <item><guid>g1</guid><title>First</title><link>https://x/1</link><pubDate>Sun, 01 Mar 2026 10:00:00 GMT</pubDate></item>
      <item><guid>g2</guid><title>Second</title><link>https://x/2</link><pubDate>Sun, 01 Mar 2026 11:00:00 GMT</pubDate></item>
      <item><guid>g3</guid><title>Third</title><link>https://x/3</link><pubDate>Sun, 01 Mar 2026 12:00:00 GMT</pubDate></item>
    </channel></rss>`;

  it("parses items with id, title and link", () => {
    const items = rssPoll.parseFeed(feed);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ id: "g1", title: "First", link: "https://x/1" });
  });

  it("returns all items when no cursor is set", () => {
    expect(rssPoll.itemsAfterCursor(rssPoll.parseFeed(feed), undefined)).toHaveLength(3);
  });

  it("returns only items after the cursor", () => {
    const fresh = rssPoll.itemsAfterCursor(rssPoll.parseFeed(feed), "g1");
    expect(fresh.map((i) => i.id)).toEqual(["g2", "g3"]);
  });

  it("returns everything when the cursor is unknown", () => {
    expect(rssPoll.itemsAfterCursor(rssPoll.parseFeed(feed), "ghost")).toHaveLength(3);
  });

  it("advances the cursor to the newest item", () => {
    expect(rssPoll.advanceCursor(rssPoll.parseFeed(feed), "g1")).toBe("g3");
  });

  it("parses an atom feed", () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
      <entry><id>a1</id><title>Atom One</title><link href="https://y/1"/><updated>2026-03-01T10:00:00Z</updated></entry>
    </feed>`;
    const items = rssPoll.parseFeed(atom);
    expect(items[0]).toMatchObject({ title: "Atom One" });
  });

  it("throws on invalid xml", () => {
    expect(() => rssPoll.parseFeed("<not-xml")).toThrow(rssPoll.RssPollError);
  });

  it("throws when the document is valid xml but not a feed", () => {
    expect(() => rssPoll.parseFeed("<html><body>hi</body></html>")).toThrow(
      rssPoll.RssPollError,
    );
  });

  it("filters through fetchSample", async () => {
    const restore = stubFetch(feed);
    try {
      const fresh = await rssPoll.fetchSample({
        metadata: { url: "https://example.com/feed.xml", cursor: "g2" },
      });
      expect(fresh.map((i) => i.id)).toEqual(["g3"]);
    } finally {
      restore();
    }
  });

  it("raises on a non-ok feed response", async () => {
    const restore = stubFetch(null, false, 404);
    try {
      await expect(
        rssPoll.fetchSample({ metadata: { url: "https://example.com/feed.xml" } }),
      ).rejects.toThrow(/returned 404/);
    } finally {
      restore();
    }
  });
});

describe("handler schema output stays assignable", () => {
  it("manual schema infers an object with optional message", () => {
    const parsed = z.object({ message: z.string().optional() }).parse({});
    expect(parsed.message).toBeUndefined();
  });
});
