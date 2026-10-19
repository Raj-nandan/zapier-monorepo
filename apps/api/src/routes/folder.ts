import { Router, type Request, type Response } from "express";
import { prisma } from "@repo/db";
import { currentUserId, requireAuth } from "../middleware/auth";

export interface FolderRouteDeps {
  secret: string;
}

export function routeParam(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function folderRouter(deps: FolderRouteDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.secret));

  router.get("/", async (req: Request, res: Response) => {
    const folders = await prisma.folder.findMany({
      where: { userId: currentUserId(req) },
      orderBy: { name: "asc" },
    });
    res.json({ folders });
  });

  router.post("/", async (req: Request, res: Response) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const folder = await prisma.folder.create({
      data: { userId: currentUserId(req), name },
    });
    res.status(201).json({ folder });
  });

  router.patch("/:id", async (req: Request, res: Response) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "invalid request" });
      return;
    }
    const updated = await prisma.folder.updateMany({
      where: { id: routeParam(req, "id"), userId: currentUserId(req) },
      data: { name },
    });
    if (updated.count === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ id: req.params.id, name });
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    const deleted = await prisma.folder.deleteMany({
      where: { id: routeParam(req, "id"), userId: currentUserId(req) },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
