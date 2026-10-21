import { Router, type Request, type Response } from "express";
import { prisma } from "@repo/db";
import { logger } from "@repo/logger";
import { getRedis } from "../lib/redis";
import { OAuthError, type FetchLike } from "../lib/oauth";
import {
  CONNECTION_STATE_PREFIX,
  CONNECTION_STATE_TTL_SECONDS,
  authorizationUrl,
  encrypt,
  exchangeConnectionCode,
  pkceChallenge,
  randomValue,
} from "../lib/connections";
import { currentUserId, requireAuth } from "../middleware/auth";
import { checkReauth, sendReauthRequired } from "../lib/reauth";
import type { ConnectionApp } from "@repo/schemas";

export interface ConnectionsRouteDeps {
  secret: string;
  fetchImpl?: FetchLike;
  webUrl?: string;
}

function appParamOf(req: Request): string {
  return Array.isArray(req.params.app) ? req.params.app[0] ?? "" : req.params.app ?? "";
}

function isApp(value: string): value is ConnectionApp {
  return value === "gmail" || value === "github";
}

export function connectionsRouter(deps: ConnectionsRouteDeps): Router {
  const router = Router();

  const onError = (error: Error, res: Response): void => {
    if (error instanceof OAuthError) {
      logger.warn({ event: "oauth_fail", reason: error.reason }, "connection callback rejected");
      res.status(error.status).json({ error: error.reason });
      return;
    }
    logger.error({ err: error.message }, "connection failure");
    res.status(500).json({ error: "internal error" });
  };

  router.get("/", requireAuth(deps.secret), async (req: Request, res: Response) => {
    const rows = await prisma.connectedAccount.findMany({
      where: { userId: currentUserId(req) },
      select: { id: true, app: true, accountLabel: true, scope: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ connections: rows });
  });

  router.get("/callback/:app", (req: Request, res: Response) => {
    handleCallback(appParamOf(req), req, res, deps).catch((error: Error) => onError(error, res));
  });

async function handleCallback(
  appParam: string,
  req: Request,
  res: Response,
  deps: ConnectionsRouteDeps,
): Promise<void> {
  if (!isApp(appParam)) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  if (!code || !state) {
    res.status(400).json({ error: "invalid request" });
    return;
  }

  const redis = await getRedis();
    const key = `${CONNECTION_STATE_PREFIX}${state}`;
    const stored = await redis.get(key);
    await redis.del(key);
    if (!stored) {
      throw new OAuthError("invalid or expired state", 401);
    }
    const parsed = JSON.parse(stored) as { app: ConnectionApp; codeVerifier: string; userId: string };
    if (parsed.app !== appParam) {
      throw new OAuthError("state app mismatch", 401);
    }

    const tokens = await exchangeConnectionCode({
      app: appParam,
      code,
      codeVerifier: parsed.codeVerifier,
      fetchImpl: deps.fetchImpl,
    });

    const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
    if (!user) {
      throw new OAuthError("account not found", 401);
    }

    const existing = await prisma.connectedAccount.findUnique({
      where: { userId_app: { userId: user.id, app: appParam } },
    });

    const expiresAt = tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null;
    const data = {
      accountLabel: user.email,
      accessEnc: encrypt(tokens.accessToken),
      refreshEnc: tokens.refreshToken ? encrypt(tokens.refreshToken) : existing?.refreshEnc ?? null,
      scope: tokens.scope ?? null,
      expiresAt,
    };

    const row = existing
      ? await prisma.connectedAccount.update({ where: { id: existing.id }, data })
      : await prisma.connectedAccount.create({
          data: { userId: user.id, app: appParam, ...data },
        });

    logger.info({ connectionId: row.id, app: appParam }, "connection established");
    res.redirect(302, `${deps.webUrl ?? "http://localhost:3000"}/settings`);
}

  router.post("/:app", requireAuth(deps.secret), async (req: Request, res: Response) => {
    const appParam = Array.isArray(req.params.app) ? req.params.app[0] : req.params.app;
    if (!isApp(appParam)) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const state = randomValue();
    const codeVerifier = randomValue(48);
    const redis = await getRedis();
    await redis.set(
      `${CONNECTION_STATE_PREFIX}${state}`,
      JSON.stringify({ app: appParam, codeVerifier, userId: currentUserId(req) }),
      { EX: CONNECTION_STATE_TTL_SECONDS },
    );

    res.json({
      authorizeUrl: authorizationUrl(appParam, state, pkceChallenge(codeVerifier)),
    });
  });

  router.delete("/:id", requireAuth(deps.secret), async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const reauth = await checkReauth(req, userId);
    if (!reauth.ok) {
      sendReauthRequired(res);
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deleted = await prisma.connectedAccount.deleteMany({
      where: { id, userId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
