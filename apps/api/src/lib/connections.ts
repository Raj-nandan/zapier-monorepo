import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@repo/config";
import { prisma } from "@repo/db";
import type { ConnectionApp, ServerAppConnection } from "@repo/schemas";
import {
  OAuthError,
  pkceChallenge,
  randomValue,
  type FetchLike,
} from "./oauth";

export const CONNECTION_STATE_PREFIX = "oauth:connection:";
export const CONNECTION_STATE_TTL_SECONDS = 600;
export const REFRESH_WINDOW_MS = 5 * 60 * 1000;
export const APP_SCOPES: Record<ConnectionApp, string> = {
  gmail: "https://www.googleapis.com/auth/gmail.send",
  github: "repo",
};

export interface ConnectionProviderConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
}

export function connectionConfig(app: ConnectionApp): ConnectionProviderConfig {
  if (app === "gmail") {
    if (!env.GMAIL_APP_ID || !env.GMAIL_APP_SECRET) {
      throw new OAuthError("gmail app oauth is not configured", 500);
    }
    return {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      clientId: env.GMAIL_APP_ID,
      clientSecret: env.GMAIL_APP_SECRET,
    };
  }
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_SECRET) {
    throw new OAuthError("github app oauth is not configured", 500);
  }
  return {
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    clientId: env.GITHUB_APP_ID,
    clientSecret: env.GITHUB_APP_SECRET,
  };
}

export function connectionRedirectUri(app: ConnectionApp): string {
  const base = env.OAUTH_REDIRECT_URL;
  if (!base) throw new OAuthError("oauth is not configured", 500);
  return `${base.replace(/\/$/, "")}/api/v1/connections/callback/${app}`;
}

function key(): Buffer {
  if (!env.TOKEN_ENC_KEY) throw new OAuthError("TOKEN_ENC_KEY is not configured", 500);
  return createHash("sha256").update(env.TOKEN_ENC_KEY).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivRaw, tagRaw, dataRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) throw new OAuthError("stored credential is malformed", 500);
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64")), decipher.final()]).toString("utf8");
}

export function authorizationUrl(app: ConnectionApp, state: string, codeChallenge: string): string {
  const config = connectionConfig(app);
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", connectionRedirectUri(app));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", APP_SCOPES[app]);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (app === "gmail") url.searchParams.set("access_type", "offline");
  if (app === "gmail") url.searchParams.set("prompt", "consent");
  return url.toString();
}

export interface ConnectionToken {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scope: string | null;
}

export async function exchangeConnectionCode(args: {
  app: ConnectionApp;
  code: string;
  codeVerifier: string;
  fetchImpl?: FetchLike;
}): Promise<ConnectionToken> {
  const config = connectionConfig(args.app);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: connectionRedirectUri(args.app),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: args.codeVerifier,
  });

  const doFetch = args.fetchImpl ?? fetch;
  const response = await doFetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new OAuthError("token exchange failed", 401);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : null,
    scope: typeof payload.scope === "string" ? payload.scope : null,
  };
}

export async function refreshAccessToken(
  app: ConnectionApp,
  refreshToken: string,
  fetchImpl?: FetchLike,
): Promise<ConnectionToken> {
  const config = connectionConfig(app);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const doFetch = fetchImpl ?? fetch;
  const response = await doFetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    throw new OAuthError("token refresh failed", 401);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
    expiresIn: typeof payload.expires_in === "number" ? payload.expires_in : null,
    scope: typeof payload.scope === "string" ? payload.scope : null,
  };
}

export async function resolveConnection(
  id: string,
  userId: string,
  fetchImpl?: FetchLike,
): Promise<ServerAppConnection | null> {
  const row = await prisma.connectedAccount.findFirst({ where: { id, userId } });
  if (!row) return null;

  const expiring = row.expiresAt !== null && row.expiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS;
  if (expiring && row.refreshEnc) {
    try {
      const refreshed = await refreshAccessToken(
        row.app as ConnectionApp,
        decrypt(row.refreshEnc),
        fetchImpl,
      );
      await prisma.connectedAccount.update({
        where: { id: row.id },
        data: {
          accessEnc: encrypt(refreshed.accessToken),
          refreshEnc: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : row.refreshEnc,
          expiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : null,
        },
      });
      return {
        id: row.id,
        app: row.app as ConnectionApp,
        accountLabel: row.accountLabel,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ? decrypt(row.refreshEnc) : null,
        expiresAt: refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : null,
        scope: row.scope,
      };
    } catch {
      return null;
    }
  }

  return {
    id: row.id,
    app: row.app as ConnectionApp,
    accountLabel: row.accountLabel,
    accessToken: row.accessEnc ? decrypt(row.accessEnc) : "",
    refreshToken: row.refreshEnc ? decrypt(row.refreshEnc) : null,
    expiresAt: row.expiresAt,
    scope: row.scope,
  };
}

export { pkceChallenge, randomValue };
