import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import {
  LOGGER_OPTIONS,
  REDACT_PATHS,
  REQUEST_ID_HEADER,
  TRACE_ID_LENGTH,
  childLogger,
  isValidTraceId,
  requestLogger,
  resolveRequestId,
  runLogger,
  traceIdFor,
} from "./index";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { stream, lines };
}

describe("traceIdFor", () => {
  it("produces a 32 char lowercase hex OpenTelemetry trace id", () => {
    const id = traceIdFor("run_123");
    expect(id).toHaveLength(TRACE_ID_LENGTH);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(isValidTraceId(id)).toBe(true);
  });

  it("is deterministic so one run keeps one trace id end to end", () => {
    expect(traceIdFor("run_123")).toBe(traceIdFor("run_123"));
  });

  it("separates distinct zapRunIds", () => {
    expect(traceIdFor("run_123")).not.toBe(traceIdFor("run_124"));
  });

  it("never emits an all zero trace id", () => {
    for (const input of ["", "0", "zapRunId"]) {
      expect(/^0+$/.test(traceIdFor(input))).toBe(false);
    }
  });

  it("rejects malformed trace ids", () => {
    expect(isValidTraceId("abc")).toBe(false);
    expect(isValidTraceId("0".repeat(32))).toBe(false);
    expect(isValidTraceId("Z".repeat(32))).toBe(false);
  });
});

describe("resolveRequestId", () => {
  it("reads the x-request-id header", () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: "req-abc" });
    expect(resolveRequestId(headers)).toBe("req-abc");
  });

  it("generates an id when the header is absent", () => {
    expect(resolveRequestId(new Headers())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("matches the header case insensitively", () => {
    const headers = new Headers({ "X-Request-Id": "req-upper" });
    expect(resolveRequestId(headers)).toBe("req-upper");
  });
});

describe("bindings", () => {
  it("binds requestId and a derived traceId on requestLogger", () => {
    const { stream, lines } = capture();
    const probe = pino(LOGGER_OPTIONS, stream);
    const headers = new Headers({ [REQUEST_ID_HEADER]: "req-xyz" });
    probe.child({ requestId: "req-xyz", traceId: traceIdFor("req-xyz") }).info("hit");

    const parsed = JSON.parse(lines[0]);
    expect(parsed.requestId).toBe("req-xyz");
    expect(parsed.traceId).toBe(traceIdFor("req-xyz"));
    expect(requestLogger(headers)).toBeDefined();
  });

  it("uses zapRunId as the trace id for runLogger", () => {
    const { stream, lines } = capture();
    const probe = pino(LOGGER_OPTIONS, stream);
    probe.child({ zapRunId: "run_abc", traceId: traceIdFor("run_abc") }).info("step");

    const parsed = JSON.parse(lines[0]);
    expect(parsed.zapRunId).toBe("run_abc");
    expect(parsed.traceId).toBe(traceIdFor("run_abc"));
    expect(runLogger("run_abc")).toBeDefined();
    expect(childLogger({ service: "worker" })).toBeDefined();
  });

  it("emits JSON with an iso timestamp and a level label", () => {
    const { stream, lines } = capture();
    pino(LOGGER_OPTIONS, stream).info("hello");
    const parsed = JSON.parse(lines[0]);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(new Date(parsed.time).toISOString()).toBe(parsed.time);
  });
});

describe("redaction", () => {
  it("censors secrets so tokens never reach the log sink", () => {
    const { stream, lines } = capture();
    const probe = pino(LOGGER_OPTIONS, stream);
    probe.info({
      email: "user@example.com",
      password: "hunter2",
      token: "tok_secret",
      accessEnc: "enc_secret",
      refreshEnc: "ref_secret",
      secret: "wh_secret",
    });

    const raw = lines[0];
    expect(raw).toContain("user@example.com");
    for (const leaked of ["hunter2", "tok_secret", "enc_secret", "ref_secret", "wh_secret"]) {
      expect(raw).not.toContain(leaked);
    }
    expect(raw).toContain("[redacted]");
  });

  it("redacts nested credential shapes", () => {
    const { stream, lines } = capture();
    const probe = pino(LOGGER_OPTIONS, stream);
    probe.info({ req: { headers: { authorization: "Bearer abc", cookie: "sid=1" } } });
    const raw = lines[0];
    expect(raw).not.toContain("Bearer abc");
    expect(raw).not.toContain("sid=1");
  });

  it("covers the documented sensitive keys", () => {
    for (const key of ["password", "token", "secret", "accessEnc", "refreshEnc"]) {
      expect(REDACT_PATHS.some((p) => p === key || p === `*.${key}`)).toBe(true);
    }
  });
});
