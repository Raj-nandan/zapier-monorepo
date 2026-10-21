import { Router, type Request, type Response } from "express";
import { CSRF_COOKIE, CSRF_TTL_SECONDS, issueCsrfToken } from "../lib/csrf";

export interface CsrfRouteDeps {
  secret: string;
}

export function csrfRouter(deps: CsrfRouteDeps): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    const token = issueCsrfToken(deps.secret);
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: CSRF_TTL_SECONDS * 1000,
    });
    res.json({ csrfToken: token });
  });

  return router;
}
