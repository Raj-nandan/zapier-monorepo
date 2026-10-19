import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DuplicateActionError,
  UnknownActionError,
  createRegistry,
  getHandler,
  hasHandler,
  listHandlers,
  type ActionHandler,
  type ActionOutcome,
} from "./types";

function handler(slug: string): ActionHandler {
  return {
    slug,
    schema: z.object({}).passthrough(),
    fields: [],
    run: async () => ({ kind: "success", output: {} }) as ActionOutcome,
  };
}

describe("createRegistry", () => {
  it("keys handlers by slug", () => {
    const registry = createRegistry([handler("email"), handler("filter")]);
    expect(registry.size).toBe(2);
    expect(registry.get("filter")?.slug).toBe("filter");
  });

  it("rejects a duplicate slug instead of silently shadowing", () => {
    expect(() => createRegistry([handler("delay"), handler("delay")])).toThrow(
      DuplicateActionError,
    );
  });
});

describe("getHandler", () => {
  it("returns the handler for a known slug", () => {
    const registry = createRegistry([handler("slack")]);
    expect(getHandler(registry, "slack").slug).toBe("slack");
  });

  it("throws UnknownActionError for an unknown slug", () => {
    const registry = createRegistry([handler("slack")]);
    expect(() => getHandler(registry, "ghost")).toThrow(UnknownActionError);
    expect(() => getHandler(registry, "ghost")).toThrow(/unknown action handler: ghost/);
  });
});

describe("hasHandler and listHandlers", () => {
  it("reports presence without throwing", () => {
    const registry = createRegistry([handler("email"), handler("discord")]);
    expect(hasHandler(registry, "email")).toBe(true);
    expect(hasHandler(registry, "http-request")).toBe(false);
    expect(listHandlers(registry).map((h) => h.slug)).toEqual(["email", "discord"]);
  });
});

describe("ActionOutcome vocabulary", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("represents success with output", async () => {
    const h: ActionHandler = {
      slug: "email",
      schema: z.object({}).passthrough(),
      fields: [],
      run: async () => ({ kind: "success", output: { messageId: "m1" } }),
    };
    expect(await h.run({ metadata: {}, context: {} })).toEqual({
      kind: "success",
      output: { messageId: "m1" },
    });
  });

  it("represents a filter skip with a reason", async () => {
    const h: ActionHandler = {
      slug: "filter",
      schema: z.object({}).passthrough(),
      fields: [],
      run: async () => ({ kind: "skip", reason: "condition not met" }),
    };
    expect(await h.run({ metadata: {}, context: {} })).toEqual({
      kind: "skip",
      reason: "condition not met",
    });
  });

  it("represents a delay suspend with resumeAt rather than sleeping", async () => {
    const h: ActionHandler = {
      slug: "delay",
      schema: z.object({}).passthrough(),
      fields: [],
      run: async () => ({ kind: "suspend", resumeAt: now }),
    };
    const outcome = await h.run({ metadata: {}, context: {} });
    expect(outcome).toEqual({ kind: "suspend", resumeAt: now });
    if (outcome.kind === "suspend") {
      expect(outcome.resumeAt).toBeInstanceOf(Date);
    }
  });

  it("covers all three documented outcomes", () => {
    const kinds: ActionOutcome["kind"][] = ["success", "skip", "suspend"];
    expect(kinds).toEqual(["success", "skip", "suspend"]);
  });
});

describe("registry exported from index", () => {
  it("exposes the six handlers added in phase 03 step 3", async () => {
    const mod = await import("./index");
    expect(mod.registry.size).toBe(6);
    expect(() => mod.getHandler(mod.registry, "ghost")).toThrow(UnknownActionError);
  });
});
