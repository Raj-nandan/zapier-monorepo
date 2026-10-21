import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { accessSecret } from "./jwt";

export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";
export const CSRF_TTL_SECONDS = 60 * 60;

export function issueCsrfToken(secret: string): string {
  const nonce = randomBytes(16).toString("hex");
  return jwt.sign({ csrf: nonce }, accessSecret(secret), {
    algorithm: "HS256",
    expiresIn: CSRF_TTL_SECONDS,
  });
}

export function verifyCsrfToken(token: string, secret: string): boolean {
  try {
    jwt.verify(token, accessSecret(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function csrfProtect(secret: string) {
  return (req: any, res: any, next: any): void => {
    const method = String(req.method || "").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      next();
      return;
    }
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
    // Anonymous / not opted-in requests are allowed through (double-submit only
    // activates once a csrf_token cookie has been issued via GET /api/v1/csrf).
    if (!cookieToken) {
      next();
      return;
    }
    const headerToken = (req.header ? req.header(CSRF_HEADER) : req.headers?.[CSRF_HEADER]) as
      | string
      | undefined;
    if (!headerToken || !safeEqual(cookieToken, headerToken)) {
      res.status(403).json({ error: "Your session changed. Reload the page and try again." });
      return;
    }
    if (!verifyCsrfToken(cookieToken, secret)) {
      res.status(403).json({ error: "Your session changed. Reload the page and try again." });
      return;
    }
    next();
  };
}
