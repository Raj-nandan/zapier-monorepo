import { Router, type Request, type Response } from "express";
import { prisma } from "@repo/db";
import { registry as triggerRegistry } from "@repo/triggers";
import { registry as actionRegistry } from "@repo/actions";
import { requireAuth } from "../middleware/auth";

export interface CatalogRouteDeps {
  secret: string;
}

export function triggerRouter(deps: CatalogRouteDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.secret));

  router.get("/available", async (_req: Request, res: Response) => {
    const rows = await prisma.availableTrigger.findMany({ orderBy: { slug: "asc" } });
    res.json({
      triggers: rows.map((row) => {
        const handler = triggerRegistry.get(row.slug);
        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          fields: handler?.fields ?? [],
        };
      }),
    });
  });

  return router;
}

export function actionRouter(deps: CatalogRouteDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.secret));

  router.get("/available", async (_req: Request, res: Response) => {
    const rows = await prisma.availableAction.findMany({ orderBy: { slug: "asc" } });
    res.json({
      actions: rows.map((row) => {
        const handler = actionRegistry.get(row.slug);
        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          fields: handler?.fields ?? [],
        };
      }),
    });
  });

  return router;
}
