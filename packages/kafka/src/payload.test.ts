import { describe, expect, it } from "vitest";
import { ZAP_EVENTS_KEY, ZAP_EVENTS_PARTITIONS, topicConfig, topics } from "./topics";
import { decodeZapEvent, encodeZapEvent, zapEventPayloadSchema } from "./payload";

const valid = {
  zapRunId: "run_123",
  zapId: "zap_456",
  zapRevision: 3,
  attempt: 0,
};

describe("zap-events topics", () => {
  it("uses the documented topic names", () => {
    expect(topics.zapEvents).toBe("zap-events");
    expect(topics.zapEventsRetry).toBe("zap-events.retry");
    expect(topics.zapEventsDLT).toBe("zap-events.DLT");
  });

  it("partitions zap-events 12 ways and keys by zapId", () => {
    expect(ZAP_EVENTS_PARTITIONS).toBe(12);
    expect(ZAP_EVENTS_KEY).toBe("zapId");
    expect(topicConfig[topics.zapEvents]).toEqual({
      numPartitions: 12,
      key: "zapId",
    });
  });
});

describe("zapEventPayload", () => {
  it("round-trips a valid payload", () => {
    const decoded = decodeZapEvent(encodeZapEvent(valid));
    expect(decoded).toEqual(valid);
  });

  it("carries ids only and strips business data", () => {
    const decoded = decodeZapEvent(
      encodeZapEvent({ ...valid, email: "leak@example.com" } as never),
    );
    expect(decoded).toEqual(valid);
    expect(JSON.stringify(decoded)).not.toContain("leak@example.com");
  });

  it("rejects a payload missing zapRevision", () => {
    expect(zapEventPayloadSchema.safeParse({ ...valid, zapRevision: undefined }).success).toBe(
      false,
    );
  });

  it("rejects a non-positive zapRevision", () => {
    expect(zapEventPayloadSchema.safeParse({ ...valid, zapRevision: 0 }).success).toBe(false);
  });

  it("rejects a negative attempt", () => {
    expect(zapEventPayloadSchema.safeParse({ ...valid, attempt: -1 }).success).toBe(false);
  });

  it("throws on an empty message", () => {
    expect(() => decodeZapEvent(Buffer.alloc(0))).toThrow(/empty/);
  });

  it("throws on malformed json", () => {
    expect(() => decodeZapEvent(Buffer.from("{not json", "utf8"))).toThrow();
  });
});
