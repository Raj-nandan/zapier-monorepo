import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_BODY_BYTES = 1048576;
export const TIMESTAMP_WINDOW_SECONDS = 5 * 60;
export const PER_IP_LIMIT = 60;
export const PER_ZAP_LIMIT = 300;
export const RATE_WINDOW_SECONDS = 60;
export const IDEMPOTENCY_TTL_SECONDS = 30 * 24 * 60 * 60;

export const SIGNATURE_HEADER = "x-zap-signature";
export const TIMESTAMP_HEADER = "x-zap-timestamp";
export const IDEMPOTENCY_HEADER = "x-idempotency-key";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VerifyFailure =
  | "missing-signature"
  | "missing-timestamp"
  | "stale-timestamp"
  | "signature-mismatch"
  | "oversize"
  | "missing-idempotency-key"
  | "invalid-idempotency-key";

export class VerifyError extends Error {
  readonly reason: VerifyFailure;
  readonly status: number;
  constructor(reason: VerifyFailure, status: number) {
    super(reason);
    this.name = "VerifyError";
    this.reason = reason;
    this.status = status;
  }
}

export function canonicalMessage(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function sign(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret)
    .update(canonicalMessage(timestamp, rawBody))
    .digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function timestampWithinWindow(
  timestamp: string,
  now: number = Date.now(),
  windowSeconds: number = TIMESTAMP_WINDOW_SECONDS,
): boolean {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  return Math.abs(now / 1000 - seconds) <= windowSeconds;
}

export function bodyWithinLimit(rawBody: string, limit = MAX_BODY_BYTES): boolean {
  return Buffer.byteLength(rawBody, "utf8") <= limit;
}

export function verifySignature(args: {
  secret: string;
  signature: string | undefined;
  timestamp: string | undefined;
  rawBody: string;
  now?: number;
  windowSeconds?: number;
}): void {
  const { secret, signature, timestamp, rawBody, now, windowSeconds } = args;

  if (!signature) throw new VerifyError("missing-signature", 401);
  if (!timestamp) throw new VerifyError("missing-timestamp", 401);
  if (!bodyWithinLimit(rawBody)) throw new VerifyError("oversize", 413);
  if (!timestampWithinWindow(timestamp, now, windowSeconds)) {
    throw new VerifyError("stale-timestamp", 401);
  }

  const expected = sign(secret, timestamp, rawBody);
  if (!safeEqual(expected, signature)) {
    throw new VerifyError("signature-mismatch", 401);
  }
}

export function verifyIdempotencyKey(key: string | undefined): string {
  if (!key) throw new VerifyError("missing-idempotency-key", 400);
  if (!UUID_PATTERN.test(key)) throw new VerifyError("invalid-idempotency-key", 400);
  return key;
}
