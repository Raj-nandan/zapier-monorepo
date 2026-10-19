import { Router, type Request, type Response } from "express";
import { prisma } from "@repo/db";
import { currentUserId, requireAuth } from "../middleware/auth";

export interface DashboardRouteDeps {
  secret: string;
}

export function dashboardRouter(deps: DashboardRouteDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.secret));

  router.get("/", async (req: Request, res: Response) => {
    const userId = currentUserId(req);

    const [zaps, byStatus, latency, recent] = await Promise.all([
      prisma.zap.findMany({
        where: { userId },
        select: { id: true, name: true, active: true, revision: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.zapRun.groupBy({
        by: ["status"],
        where: { zap: { userId } },
        _count: { _all: true },
      }),
      prisma.zapRun.findMany({
        where: { zap: { userId }, startedAt: { not: null }, finishedAt: { not: null } },
        select: { startedAt: true, finishedAt: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      }),
      prisma.zapRun.findMany({
        where: { zap: { userId } },
        select: {
          id: true,
          zapId: true,
          status: true,
          error: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
        },
        orderBy: { id: "desc" },
        take: 10,
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of byStatus) {
      counts[row.status] = row._count._all;
    }

    const durations = latency
      .map((row) =>
        row.startedAt && row.finishedAt
          ? row.finishedAt.getTime() - row.startedAt.getTime()
          : null,
      )
      .filter((value): value is number => value !== null && value >= 0);

    const averageLatencyMs = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null;

    res.json({
      activeZaps: zaps.filter((zap) => zap.active).length,
      totalZaps: zaps.length,
      runCounts: counts,
      totalRuns: Object.values(counts).reduce((sum, value) => sum + value, 0),
      averageLatencyMs,
      zaps,
      recentRuns: recent,
    });
  });

  return router;
}
