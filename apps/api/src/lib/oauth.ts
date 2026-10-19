import { createCipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@repo/config";

export const STATE_TTL_SECONDS = 600;
export const SCOPES = {
  google: "openid email profile",
  github: "read:user user:email",
} as const;

export type OAuthProvider = keyof typeof SCOPES;

export interface ProviderConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  clientId: string;
  clientSecret: string;
}

export class OAuthError extends Error {
  readonly reason: string;
  readonly status: number;
  constructor(reason: string, status = 401) {
    super(reason);
    this.name = "OAuthError";
    this.reason = reason;
    this.status = status;
  }
}

export function redirectUri(): string {
  const base = env.OAUTH_REDIRECT_URL;
  if (!base) throw new OAuthError("oauth is not configured", 500);
  return `${base.replace(/\/$/, "")}/api/v1/auth/callback`;
}

export function providerConfig(provider: OAuthProvider): ProviderConfig {
  if (provider === "google") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new OAuthError("google oauth is not configured", 500);
    }
    return {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      userinfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new OAuthError("github oauth is not configured", 500);
  }
  return {
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    userinfoEndpoint: "https://api.github.com/user",
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  };
}

export function randomValue(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface AuthorizationParams {
  provider: OAuthProvider;
  state: string;
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
}

export function authorizationUrl(params: AuthorizationParams): string {
  const config = providerConfig(params.provider);
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${redirectUri()}/${params.provider}`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES[params.provider]);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (params.provider === "google") url.searchParams.set("nonce", params.nonce);
  return url.toString();
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
}

export async function exchangeCode(args: {
  provider: OAuthProvider;
  code: string;
  codeVerifier: string;
  fetchImpl?: FetchLike;
}): Promise<TokenResponse> {
  const config = providerConfig(args.provider);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: `${redirectUri()}/${args.provider}`,
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
  };
}

export interface OAuthProfile {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export async function fetchProfile(args: {
  provider: OAuthProvider;
  accessToken: string;
  fetchImpl?: FetchLike;
}): Promise<OAuthProfile> {
  const config = providerConfig(args.provider);
  const doFetch = args.fetchImpl ?? fetch;
  const response = await doFetch(config.userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: "application/json",
      "User-Agent": "zapier-monorepo",
    },
  });

  if (!response.ok) {
    throw new OAuthError("profile fetch failed", 401);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  if (args.provider === "google") {
    const verified = payload.email_verified;
    if (!payload.email || verified !== true && verified !== "true") {
      throw new OAuthError("google email is not verified", 401);
    }
    return {
      providerAccountId: String(payload.sub ?? ""),
      email: String(payload.email).toLowerCase(),
      emailVerified: true,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  }

  const emailsResponse = await doFetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: "application/json",
      "User-Agent": "zapier-monorepo",
    },
  });
  const emails = emailsResponse.ok
    ? ((await emailsResponse.json()) as Array<Record<string, unknown>>)
    : [];
  const primary = emails.find((e) => e.primary === true && e.verified === true) ?? emails.find((e) => e.verified === true);

  return {
    providerAccountId: String(payload.id ?? ""),
    email: primary?.email ? String(primary.email).toLowerCase() : null,
    emailVerified: Boolean(primary),
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function encryptSecret(plain: string): string {
  const key = env.TOKEN_ENC_KEY;
  if (!key) throw new OAuthError("TOKEN_ENC_KEY is not configured", 500);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(key).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}
