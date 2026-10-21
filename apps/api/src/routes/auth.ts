import { Router, type Request, type Response } from "express";
import { prisma } from "@repo/db";
import { logger } from "@repo/logger";
import { getRedis } from "../lib/redis";
import {
  STATE_TTL_SECONDS,
  OAuthError,
  authorizationUrl,
  encryptSecret,
  exchangeCode,
  fetchProfile,
  pkceChallenge,
  providerConfig,
  randomValue,
  type FetchLike,
  type OAuthProvider,
} from "../lib/oauth";
import { clearSessionCookies, issueSession, setSessionCookies } from "../lib/session";
import { safeNext } from "../lib/safeNext";
import { env } from "@repo/config";
export const STATE_PREFIX = "oauth:state:";

export interface AuthRouteDeps {
  secret: string;
  fetchImpl?: FetchLike;
  dashboardUrl?: string;
}



export function authRouter(deps: AuthRouteDeps): Router {
  const router = Router();

  async function begin(provider: OAuthProvider, req: Request, res: Response): Promise<void> {
    const next = safeNext(req.query.next);
    const state = randomValue();
    const nonce = randomValue();
    const codeVerifier = randomValue(48);
    const redis = await getRedis();
    await redis.set(
      `${STATE_PREFIX}${state}`,
      JSON.stringify({ provider, nonce, codeVerifier, next }),
      { EX: STATE_TTL_SECONDS },
    );
    res.redirect(302, authorizationUrl({ provider, state, nonce, codeVerifier, codeChallenge: pkceChallenge(codeVerifier) }));
  }

  async function callback(provider: OAuthProvider, req: Request, res: Response): Promise<void> {
    const providerError = typeof req.query.error === "string" ? req.query.error : null;
    if (providerError) {
      const code = providerError === "access_denied" ? "access_denied" : "provider_error";
      res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=${code}`);
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    if (!code || !state) {
      res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=provider_error`);
      return;
    }

    const redis = await getRedis();
    const key = `${STATE_PREFIX}${state}`;
    const stored = await redis.get(key);
    await redis.del(key);

    if (!stored) {
      res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=state_mismatch`);
      return;
    }
    const parsed = JSON.parse(stored) as {
      provider: OAuthProvider;
      nonce: string;
      codeVerifier: string;
      next?: string;
    };
    if (parsed.provider !== provider) {
      res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=state_mismatch`);
      return;
    }

    const tokens = await exchangeCode({
      provider,
      code,
      codeVerifier: parsed.codeVerifier,
      fetchImpl: deps.fetchImpl,
    });

    const profile = await fetchProfile({
      provider,
      accessToken: tokens.accessToken,
      fetchImpl: deps.fetchImpl,
    });

    if (!profile.email || !profile.emailVerified) {
      throw new OAuthError("verified email is required", 401);
    }
    const verifiedEmail = profile.email;

    const accessEnc = encryptSecret(tokens.accessToken);

    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      });

      if (existing) {
        return tx.user.update({
          where: { id: existing.userId },
          data: {
            name: user1Name(profile.name) ?? undefined,
            accounts: { update: { where: { id: existing.id }, data: { accessTokenEnc: accessEnc } } },
          },
        });
      }

      const byEmail = await tx.user.findUnique({ where: { email: verifiedEmail } });
      if (byEmail) {
        await tx.account.create({
          data: {
            userId: byEmail.id,
            provider,
            providerAccountId: profile.providerAccountId,
            email: verifiedEmail,
            accessTokenEnc: accessEnc,
          },
        });
        return tx.user.update({
          where: { id: byEmail.id },
          data: { name: user1Name(profile.name) ?? undefined },
        });
      }

      const created = await tx.user.create({
        data: { email: verifiedEmail, name: profile.name },
      });
      await tx.account.create({
        data: {
          userId: created.id,
          provider,
          providerAccountId: profile.providerAccountId,
          email: verifiedEmail,
          accessTokenEnc: accessEnc,
        },
      });
      return created;
    });

    const session = await issueSession(user.id, user.email, user.tokenVersion, deps.secret);
    setSessionCookies(res, session);
    const destination = safeNext(parsed.next);
    const base = (deps.dashboardUrl ?? env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
    // dashboardUrl may include /dashboard suffix; strip trailing path
    const origin = base.replace(/\/dashboard$/, "");
    res.redirect(302, `${origin}${destination}`);
  }

  router.get("/google", (req: Request, res: Response) => {
    begin("google", req, res).catch(nextError(res));
  });

  router.get("/github", (req: Request, res: Response) => {
    begin("github", req, res).catch(nextError(res));
  });

  router.get("/callback/google", (req: Request, res: Response) => {
    callback("google", req, res).catch((error: Error) => {
      if (error instanceof OAuthError) {
        logger.warn({ event: "oauth_fail", reason: error.reason }, "oauth callback rejected");
        res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=provider_error`);
        return;
      }
      logger.error({ err: error.message }, "oauth failure");
      clearSessionCookies(res);
      res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=provider_error`);
    });
  });

  router.get("/callback/github", (req: Request, res: Response) => {
    callback("github", req, res).catch((error: Error) => {
      if (error instanceof OAuthError) {
        logger.warn({ event: "oauth_fail", reason: error.reason }, "oauth callback rejected");
        res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=provider_error`);
        return;
      }
      logger.error({ err: error.message }, "oauth failure");
      clearSessionCookies(res);
      res.redirect(302, `${env.WEB_URL || "http://localhost:3000"}/auth/callback?error=provider_error`);
    });
  });

  return router;
}

function user1Name(name: string | null): string | null {
  return name && name.trim() ? name.trim() : null;
}

function nextError(res: Response) {
  return (error: Error): void => {
    if (error instanceof OAuthError) {
      logger.warn({ event: "oauth_fail", reason: error.reason }, "oauth callback rejected");
      res.status(error.status).json({ error: error.reason });
      return;
    }
    logger.error({ err: error.message }, "oauth failure");
    clearSessionCookies(res);
    res.status(500).json({ error: "internal error" });
  };
}

export { providerConfig };
