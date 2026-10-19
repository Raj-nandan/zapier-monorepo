import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const JWT_ALGORITHM = "HS256" as const;

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export interface AccessClaims {
  userId: string;
  email: string;
  v: number;
  jti: string;
}

export interface RefreshClaims {
  userId: string;
  jti: string;
}

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

export function accessSecret(secret = process.env.JWT_PASSWORD || ""): string {
  if (!secret) throw new TokenError("JWT_PASSWORD is not configured");
  return secret;
}

export function signAccessToken(
  claims: Omit<AccessClaims, "jti"> & { jti?: string },
  secret: string,
): { token: string; jti: string; expiresIn: number } {
  const jti = claims.jti ?? randomUUID();
  const token = jwt.sign(
    { userId: claims.userId, email: claims.email, v: claims.v, jti },
    accessSecret(secret),
    { algorithm: JWT_ALGORITHM, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
  return { token, jti, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export function signRefreshToken(
  claims: Omit<RefreshClaims, "jti"> & { jti?: string },
  secret: string,
): { token: string; jti: string; expiresIn: number } {
  const jti = claims.jti ?? randomUUID();
  const token = jwt.sign(
    { userId: claims.userId, jti, type: "refresh" },
    accessSecret(secret),
    { algorithm: JWT_ALGORITHM, expiresIn: REFRESH_TOKEN_TTL_SECONDS },
  );
  return { token, jti, expiresIn: REFRESH_TOKEN_TTL_SECONDS };
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  try {
    const decoded = jwt.verify(token, accessSecret(secret), {
      algorithms: [JWT_ALGORITHM],
    }) as Record<string, unknown>;
    if (decoded.type === "refresh") {
      throw new TokenError("refresh token cannot be used as an access token");
    }
    if (
      typeof decoded.userId !== "string" ||
      typeof decoded.email !== "string" ||
      typeof decoded.v !== "number" ||
      typeof decoded.jti !== "string"
    ) {
      throw new TokenError("access token is missing required claims");
    }
    return {
      userId: decoded.userId,
      email: decoded.email,
      v: decoded.v,
      jti: decoded.jti,
    };
  } catch (error) {
    if (error instanceof TokenError) throw error;
    throw new TokenError("invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string, secret: string): RefreshClaims {
  try {
    const decoded = jwt.verify(token, accessSecret(secret), {
      algorithms: [JWT_ALGORITHM],
    }) as Record<string, unknown>;
    if (decoded.type !== "refresh") {
      throw new TokenError("access token cannot be used as a refresh token");
    }
    if (typeof decoded.userId !== "string" || typeof decoded.jti !== "string") {
      throw new TokenError("refresh token is missing required claims");
    }
    return { userId: decoded.userId, jti: decoded.jti };
  } catch (error) {
    if (error instanceof TokenError) throw error;
    throw new TokenError("invalid or expired refresh token");
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
