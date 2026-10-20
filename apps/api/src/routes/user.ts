import { Router, type Request, type Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { forgotSchema, resetSchema, signinSchema, signupSchema } from "@repo/schemas";
import { logger } from "@repo/logger";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  TokenError,
  verifyAccessToken,
  verifyRefreshToken,
} from "../lib/jwt";
import { passwordResetMailer, resetLink, type Mailer } from "../lib/email";
import {
  clearFailedAttempts,
  clearSessionCookies,
  consumeRefresh,
  isLockedOut,
  issueSession,
  recordFailedAttempt,
  revokeAllSessions,
  setSessionCookies,
} from "../lib/session";
import { extractRefreshCookie, revokeJti, requireAuth } from "../middleware/auth";
import { byIp, rateLimit } from "../middleware/rateLimit";

export const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
export const GENERIC_AUTH_ERROR = "invalid credentials";

export interface UserRouteDeps {
  secret: string;
  mailer?: Mailer;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function lockKey(req: Request, email: string): string {
  return `${req.ip ?? "unknown"}|${email}`;
}

export function userRouter(deps: UserRouteDeps): Router {
  const router = Router();
  const mailer = deps.mailer ?? passwordResetMailer();

  router.post(
    "/signup",
    rateLimit({ limit: 20, windowSeconds: 3600, key: byIp }),
    async (req: Request, res: Response) => {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid request" });
        return;
      }
      const email = normalizeEmail(parsed.data.username);
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({ error: "unable to create account" });
        return;
      }
      const user = await prisma.user.create({
        data: {
          email,
          name: parsed.data.name ?? null,
          passwordHash: await hashPassword(parsed.data.password),
        },
      });
      const session = await issueSession(user.id, user.email, user.tokenVersion, deps.secret);
      setSessionCookies(res, session);
      res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
    },
  );

  router.post(
    "/signin",
    rateLimit({ limit: MAX_FAILED_SIGNIN_ATTEMPTS, windowSeconds: 900, key: byIp }),
    async (req: Request, res: Response) => {
      const parsed = signinSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(401).json({ error: GENERIC_AUTH_ERROR });
        return;
      }
      const email = normalizeEmail(parsed.data.username);
      const key = lockKey(req, email);
      if (await isLockedOut(key)) {
        logger.warn({ event: "auth_fail", reason: "locked" }, "signin blocked");
        res.status(429).json({ error: GENERIC_AUTH_ERROR });
        return;
      }
      const user = await prisma.user.findUnique({ where: { email } });
      const ok = user?.passwordHash
        ? await verifyPassword(parsed.data.password, user.passwordHash)
        : false;
      if (!user || !ok) {
        await recordFailedAttempt(key);
        logger.warn({ event: "auth_fail" }, "signin rejected");
        res.status(401).json({ error: GENERIC_AUTH_ERROR });
        return;
      }
      await clearFailedAttempts(key);
      const session = await issueSession(user.id, user.email, user.tokenVersion, deps.secret);
      setSessionCookies(res, session);
      res.json({ user: { id: user.id, email: user.email, name: user.name } });
    },
  );

  router.post("/refresh", async (req: Request, res: Response) => {
    const token = extractRefreshCookie(req);
    if (!token) {
      res.status(401).json({ error: GENERIC_AUTH_ERROR });
      return;
    }
    let userId: string | null;
    try {
      const claims = verifyRefreshToken(token, deps.secret);
      userId = await consumeRefresh(token);
      if (!userId || userId !== claims.userId) {
        res.status(401).json({ error: GENERIC_AUTH_ERROR });
        return;
      }
    } catch (error) {
      if (error instanceof TokenError) {
        res.status(401).json({ error: GENERIC_AUTH_ERROR });
        return;
      }
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(401).json({ error: GENERIC_AUTH_ERROR });
      return;
    }
    const session = await issueSession(user.id, user.email, user.tokenVersion, deps.secret);
    setSessionCookies(res, session);
    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  });

  router.post("/logout", async (req: Request, res: Response) => {
    const access = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    if (access) {
      try {
        const claims = verifyAccessToken(access, deps.secret);
        await revokeJti(claims.jti, ACCESS_TOKEN_TTL_SECONDS);
      } catch {
        void 0;
      }
    }
    clearSessionCookies(res);
    res.json({ ok: true });
  });

  router.post(
    "/forgot",
    rateLimit({ limit: 3, windowSeconds: 3600, key: (req: Request) => `forgot:${req.body?.username ?? ""}` }),
    async (req: Request, res: Response) => {
      const parsed = forgotSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "invalid request" });
        return;
      }
      const email = normalizeEmail(parsed.data.email);
      const user = await prisma.user.findUnique({ where: { email } });
      if (user?.passwordHash) {
        const token = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        await prisma.passwordReset.create({
          data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
        });
        try {
          await mailer({ to: email, subject: "Reset your password", text: resetLink(token) });
        } catch (error) {
          logger.error({ err: (error as Error).message }, "reset email delivery failed");
        }
      }
      res.json({ ok: true });
    },
  );

  router.post("/reset", async (req: Request, res: Response) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const record = await prisma.passwordReset.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!record) {
      res.status(400).json({ error: "invalid or expired token" });
      return;
    }
    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    await revokeAllSessions(record.userId);
    clearSessionCookies(res);
    res.json({ ok: true });
  });

  router.get("/", requireAuth(deps.secret), async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ email: user.email, name: user.name });
  });

  router.patch("/", requireAuth(deps.secret), async (req: Request, res: Response) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : null;
    if (!name) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const user = await prisma.user.update({ where: { id: req.auth!.userId }, data: { name } });
    res.json({ email: user.email, name: user.name });
  });

  router.get("/export", requireAuth(deps.secret), async (req: Request, res: Response) => {
    const userId = req.auth!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const [zaps, folders, connections, runs, resets] = await Promise.all([
      prisma.zap.findMany({ where: { userId } }),
      prisma.folder.findMany({ where: { userId } }),
      prisma.connectedAccount.findMany({
        where: { userId },
        select: { id: true, app: true, accountLabel: true, scope: true, createdAt: true },
      }),
      prisma.zapRun.findMany({
        where: { zap: { userId } },
        include: { steps: true },
      }),
      prisma.passwordReset.findMany({ where: { userId }, select: { id: true, expiresAt: true, usedAt: true } }),
    ]);
    res.json({
      exportedAt: new Date().toISOString(),
      user: user ? { email: user.email, name: user.name, createdAt: user.createdAt } : null,
      folders,
      zaps,
      connections,
      runs,
      passwordResets: resets,
    });
  });

  router.delete("/", requireAuth(deps.secret), async (req: Request, res: Response) => {
    await prisma.user.delete({ where: { id: req.auth!.userId } });
    clearSessionCookies(res);
    res.json({ ok: true });
  });

  return router;
}

export const MAX_FAILED_SIGNIN_ATTEMPTS = 5;
