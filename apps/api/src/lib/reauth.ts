import { prisma } from "@repo/db";
import { verifyPassword } from "./password";

export interface ReauthResult {
  ok: boolean;
  reauthRequired: boolean;
}

export async function checkReauth(req: any, userId: string): Promise<ReauthResult> {
  const wantsStepUp =
    req?.body?.requireReauth === true ||
    req?.query?.requireReauth === "true" ||
    req?.header?.("x-require-reauth") === "true";

  const supplied =
    (typeof req?.body?.password === "string" && req.body.password) ||
    (typeof req?.query?.password === "string" && req.query.password) ||
    (typeof req?.header?.("x-reauth-password") === "string" && req.header("x-reauth-password"));

  if (wantsStepUp && !supplied) {
    return { ok: false, reauthRequired: true };
  }
  if (supplied) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const ok = user?.passwordHash ? await verifyPassword(String(supplied), user.passwordHash) : false;
    if (!ok) return { ok: false, reauthRequired: true };
  }
  return { ok: true, reauthRequired: false };
}

export function sendReauthRequired(res: any): void {
  res.status(401).json({ error: "authentication required", code: "REAUTH_REQUIRED" });
}
