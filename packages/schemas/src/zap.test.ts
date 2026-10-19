import { describe, expect, it } from "vitest";
import {
  MAX_OUTPUT_BYTES,
  MAX_PAYLOAD_BYTES,
  MAX_SUBSTITUTIONS,
  zapCreateSchema,
} from "./zap";

function base(overrides: Record<string, unknown> = {}) {
  return {
    availableTriggerId: "webhook",
    triggerMetadata: {},
    actions: [
      { availableActionId: "email", actionMetadata: {} },
      { availableActionId: "slack", actionMetadata: {} },
    ],
    ...overrides,
  };
}

describe("zapCreateSchema", () => {
  it("accepts a valid zap referencing trigger and prior steps", () => {
    const result = zapCreateSchema.safeParse(
      base({
        triggerMetadata: { filterOn: "{{trigger.output.email}}" },
        actions: [
          { availableActionId: "email", actionMetadata: { to: "{{trigger.output.email}}" } },
          {
            availableActionId: "slack",
            actionMetadata: { body: "From step1: {{step1.output.subject}}" },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a reference to a step that has not run yet", () => {
    const result = zapCreateSchema.safeParse(
      base({
        actions: [
          { availableActionId: "email", actionMetadata: { to: "{{step2.output.email}}" } },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a malformed reference that is missing the output path", () => {
    const result = zapCreateSchema.safeParse(
      base({
        triggerMetadata: { bad: "{{trigger}}" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown root reference", () => {
    const result = zapCreateSchema.safeParse(
      base({
        actions: [
          { availableActionId: "email", actionMetadata: { to: "{{ghost.output.email}}" } },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a payload over the 1MB cap", () => {
    const result = zapCreateSchema.safeParse(
      base({
        triggerMetadata: { blob: "x".repeat(MAX_PAYLOAD_BYTES + 1024) },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a payload at the 1MB boundary", () => {
    const skeleton = JSON.stringify(
      base({ triggerMetadata: { blob: "" } }),
    ).length;
    const blob = "x".repeat(MAX_PAYLOAD_BYTES - skeleton - 8);
    const result = zapCreateSchema.safeParse(base({ triggerMetadata: { blob } }));
    expect(result.success).toBe(true);
  });

  it("rejects more than the substitution cap", () => {
    const many = Array.from({ length: MAX_SUBSTITUTIONS + 5 }, () => "{{trigger.output.a}}").join(
      " ",
    );
    const result = zapCreateSchema.safeParse(base({ triggerMetadata: { many } }));
    expect(result.success).toBe(false);
  });

  it("requires at least one action", () => {
    const result = zapCreateSchema.safeParse(base({ actions: [] }));
    expect(result.success).toBe(false);
  });

  it("defaults trigger and action metadata to empty objects", () => {
    const result = zapCreateSchema.parse({
      availableTriggerId: "webhook",
      actions: [{ availableActionId: "email" }],
    });
    expect(result.triggerMetadata).toEqual({});
    expect(result.actions[0].actionMetadata).toEqual({});
  });

  it("exposes the documented parser bounds", () => {
    expect(MAX_PAYLOAD_BYTES).toBe(1048576);
    expect(MAX_SUBSTITUTIONS).toBe(100);
    expect(MAX_OUTPUT_BYTES).toBe(10240);
  });
});
