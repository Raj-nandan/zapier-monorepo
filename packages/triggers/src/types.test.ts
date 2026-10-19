import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DuplicateTriggerError,
  UnknownTriggerError,
  createRegistry,
  getHandler,
  hasHandler,
  listHandlers,
  type TriggerHandler,
} from "./types";

function handler(slug: string, fields: TriggerHandler["fields"] = []): TriggerHandler {
  return {
    slug,
    schema: z.object({}).passthrough(),
    fields,
    fetchSample: async () => [{ id: 1 }],
  };
}

describe("createRegistry", () => {
  it("keys handlers by slug", () => {
    const registry = createRegistry([handler("webhook"), handler("manual")]);
    expect(registry.size).toBe(2);
    expect(registry.get("webhook")?.slug).toBe("webhook");
    expect(registry.get("manual")?.slug).toBe("manual");
  });

  it("rejects a duplicate slug instead of silently shadowing", () => {
    expect(() => createRegistry([handler("webhook"), handler("webhook")])).toThrow(
      DuplicateTriggerError,
    );
  });

  it("builds an empty registry without handlers", () => {
    expect(createRegistry([]).size).toBe(0);
  });
});

describe("getHandler", () => {
  it("returns the handler for a known slug", () => {
    const registry = createRegistry([handler("schedule")]);
    expect(getHandler(registry, "schedule").slug).toBe("schedule");
  });

  it("throws UnknownTriggerError for an unknown slug", () => {
    const registry = createRegistry([handler("schedule")]);
    expect(() => getHandler(registry, "ghost")).toThrow(UnknownTriggerError);
    expect(() => getHandler(registry, "ghost")).toThrow(/unknown trigger handler: ghost/);
  });

  it("throws on an empty registry", () => {
    expect(() => getHandler(createRegistry([]), "webhook")).toThrow(UnknownTriggerError);
  });
});

describe("hasHandler and listHandlers", () => {
  it("reports presence without throwing", () => {
    const registry = createRegistry([handler("webhook"), handler("rss-poll")]);
    expect(hasHandler(registry, "webhook")).toBe(true);
    expect(hasHandler(registry, "ghost")).toBe(false);
  });

  it("lists every registered handler", () => {
    const registry = createRegistry([handler("webhook"), handler("github-poll")]);
    expect(listHandlers(registry).map((h) => h.slug)).toEqual(["webhook", "github-poll"]);
  });
});

describe("FieldSpec contract", () => {
  it("describes a select field with options", () => {
    const registry = createRegistry([
      handler("schedule", [
        {
          key: "cron",
          label: "Cron",
          type: "select",
          required: true,
          options: ["*/5 * * * *", "0 * * * *"],
          placeholder: "*/5 * * * *",
        },
      ]),
    ]);
    const spec = getHandler(registry, "schedule").fields[0];
    expect(spec.key).toBe("cron");
    expect(spec.type).toBe("select");
    expect(spec.required).toBe(true);
    expect(spec.options).toHaveLength(2);
  });

  it("constrains type to the documented set", () => {
    const allowed = ["text", "textarea", "number", "url", "select", "boolean"];
    for (const type of allowed) {
      const registry = createRegistry([
        handler("manual", [{ key: "k", label: "K", type: type as never, required: false }]),
      ]);
      expect(getHandler(registry, "manual").fields[0].type).toBe(type);
    }
  });
});

describe("registry exported from index", () => {
  it("exposes the five handlers added in phase 03 step 2", async () => {
    const mod = await import("./index");
    expect(mod.registry.size).toBe(5);
    expect(() => mod.getHandler(mod.registry, "ghost")).toThrow(UnknownTriggerError);
  });
});
