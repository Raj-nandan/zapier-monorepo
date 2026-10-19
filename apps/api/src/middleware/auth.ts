import type { NextFunction, Request, Response } from "express";
import { prisma } from "@repo/db";
import { getRedis } from "../lib/redis";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  TokenError,
  verifyAccessToken,
  type AccessClaims,
} from "../lib/jwt";

export interface AuthContext {
  userId: string;
  email: string;
  tokenVersion: number;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const DENYLIST_PREFIX = "denylist:jti:";

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function extractToken(req: Request): string | null {
  const header = req.header("authorization");
  if (header && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  return cookie ?? null;
}

export function extractRefreshCookie(req: Request): string | null {
  return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE] ?? null;
}

export async function revokeJti(jti: string, ttlSeconds: number): Promise<void> {
  const redis = await getRedis();
  await redis.set(`${DENYLIST_PREFIX}${jti}`, "1", { EX: ttlSeconds });
}

export async function isRevoked(jti: string): Promise<boolean> {
  const redis = await getRedis();
  return (await redis.exists(`${DENYLIST_PREFIX}${jti}`)) === 1;
}

export async function authenticate(
  req: Request,
  secret: string,
): Promise<AuthContext> {
  const token = extractToken(req);
  if (!token) {
    throw new AuthError("authentication required");
  }

  let claims: AccessClaims;
  try {
    claims = verifyAccessToken(token, secret);
  } catch (error) {
    throw new AuthError(
      error instanceof TokenError ? error.message : "invalid token",
    );
  }

  if (await isRevoked(claims.jti)) {
    throw new AuthError("session has been revoked");
  }

  const user = await prisma.user.findUnique({ where: { id: claims.userId } });
  if (!user) {
    throw new AuthError("authentication required");
  }

  if (user.tokenVersion !== claims.v) {
    throw new AuthError("session has been revoked");
  }

  return {
    userId: user.id,
    email: user.email,
    tokenVersion: user.tokenVersion,
    jti: claims.jti,
  };
}

export function requireAuth(secret: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.auth = await authenticate(req, secret);
      next();
    } catch (error) {
      const status = error instanceof AuthError ? error.status : 401;
      res.status(status).json({
        error: error instanceof AuthError ? error.message : "authentication required",
      });
    }
  };
}

export function currentUserId(req: Request): string {
  if (!req.auth) {
    throw new AuthError("authentication required");
  }
  return req.auth.userId;
}

export function assertOwned(req: Request, ownerId: string | null | undefined): void {
  if (!req.auth) {
    throw new AuthError("authentication required", 401);
  }
  if (ownerId !== req.auth.userId) {
    throw new AuthError("not found", 404);
  }
}

export function ownedWhere(req: Request, ownerId: string | null | undefined) {
  assertOwned(req, ownerId);
  return { userId: currentUserId(req) };
}
