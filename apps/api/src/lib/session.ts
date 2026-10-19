import type { Response } from "express";
import { prisma } from "@repo/db";
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  hashToken,
  signAccessToken,
  signRefreshToken,
} from "./jwt";
import { getRedis } from "./redis";

export const REFRESH_STORE_PREFIX = "refresh:";
export const LOCKOUT_PREFIX = "lockout:";
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_SECONDS = 15 * 60;

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
} as const;

export interface Session {
  accessToken: string;
  refreshToken: string;
  accessJti: string;
  refreshJti: string;
}

export async function storeRefresh(userId: string, token: string): Promise<void> {
  const redis = await getRedis();
  await redis.set(`${REFRESH_STORE_PREFIX}${hashToken(token)}`, userId, {
    EX: REFRESH_TOKEN_TTL_SECONDS,
  });
}

export async function consumeRefresh(token: string): Promise<string | null> {
  const redis = await getRedis();
  const key = `${REFRESH_STORE_PREFIX}${hashToken(token)}`;
  const userId = await redis.get(key);
  if (!userId) return null;
  await redis.del(key);
  return userId;
}

export async function issueSession(userId: string, email: string, version: number, secret: string): Promise<Session> {
  const access = signAccessToken({ userId, email, v: version }, secret);
  const refresh = signRefreshToken({ userId }, secret);
  await storeRefresh(userId, refresh.token);
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessJti: access.jti,
    refreshJti: refresh.jti,
  };
}

export function setSessionCookies(res: Response, session: Session): void {
  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...COOKIE_OPTIONS });
  res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTIONS });
}

export async function recordFailedAttempt(key: string): Promise<number> {
  const redis = await getRedis();
  const redisKey = `${LOCKOUT_PREFIX}${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, LOCKOUT_SECONDS);
  }
  return count;
}

export async function isLockedOut(key: string): Promise<boolean> {
  const redis = await getRedis();
  const value = await redis.get(`${LOCKOUT_PREFIX}${key}`);
  if (value === null) return false;
  return Number(value) >= MAX_FAILED_ATTEMPTS;
}

export async function clearFailedAttempts(key: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(`${LOCKOUT_PREFIX}${key}`);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
