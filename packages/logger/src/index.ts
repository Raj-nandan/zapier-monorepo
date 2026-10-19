import { createHash, randomUUID } from "node:crypto";
import pino, { type Logger, type LoggerOptions } from "pino";

export const REQUEST_ID_HEADER = "x-request-id";
export const TRACE_ID_LENGTH = 32;

export const REDACT_PATHS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "accessTokenEnc",
  "refreshToken",
  "refreshEnc",
  "accessEnc",
  "secret",
  "signature",
  "*.secret",
  "*.accessEnc",
  "*.refreshEnc",
  "*.accessTokenEnc",
  "*.token",
  "*.password",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
];

export const LOGGER_OPTIONS: LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
  },
};

export const logger: Logger = pino(LOGGER_OPTIONS);

export function traceIdFor(correlationId: string): string {
  const hash = createHash("sha256")
    .update(String(correlationId))
    .digest("hex")
    .slice(0, TRACE_ID_LENGTH);
  if (/^0+$/.test(hash)) {
    return `${"0".repeat(TRACE_ID_LENGTH - 1)}1`;
  }
  return hash;
}

export function isValidTraceId(value: string): boolean {
  return new RegExp(`^[0-9a-f]{${TRACE_ID_LENGTH}}$`).test(value) && !/^0+$/.test(value);
}

export function resolveRequestId(headers: Headers): string {
  return headers.get(REQUEST_ID_HEADER) || randomUUID();
}

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export function requestLogger(
  headers: Headers,
  extra: Record<string, unknown> = {},
): Logger {
  const requestId = resolveRequestId(headers);
  return logger.child({ requestId, traceId: traceIdFor(requestId), ...extra });
}

export function runLogger(zapRunId: string, extra: Record<string, unknown> = {}): Logger {
  return logger.child({ zapRunId, traceId: traceIdFor(zapRunId), ...extra });
}

export type { Logger };
