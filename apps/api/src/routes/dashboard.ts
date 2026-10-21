import { Router, type Request, type Response } from "express";
import { prisma } from "@repo/db";
import { currentUserId, requireAuth } from "../middleware/auth";

export interface DashboardRouteDeps {
  secret: string;
}

function windowDays(raw: unknown): number {
  const value = typeof raw === "string" ? raw : "30d";
  if (value === "7d") return 7;
  if (value === "90d") return 90;
  return 30;
}

export function dashboardRouter(deps: DashboardRouteDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.secret));

  router.get("/", async (req: Request, res: Response) => {
    const userId = currentUserId(req);
    const days = windowDays(req.query.window);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [zaps, byStatus, latency, recent, windowRuns, failedRuns, suspendedRuns] = await Promise.all([
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
      prisma.zapRun.findMany({
        where: { zap: { userId }, createdAt: { gte: cutoff } },
        select: { status: true, createdAt: true },
      }),
      prisma.zapRun.findMany({
        where: { zap: { userId }, status: "FAILED" },
        select: { id: true, zapId: true, error: true, createdAt: true, zap: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.zapRun.findMany({
        where: { zap: { userId }, status: "SUSPENDED" },
        select: { id: true, zapId: true, resumeAt: true, createdAt: true, zap: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
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

    // Bucket runs per day for the window.
    const buckets = new Map<string, { succeeded: number; failed: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { succeeded: 0, failed: 0 });
    }
    for (const run of windowRuns) {
      const key = run.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (run.status === "SUCCESS") bucket.succeeded += 1;
      else if (run.status === "FAILED") bucket.failed += 1;
    }
    const runsPerDay = Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      succeeded: v.succeeded,
      failed: v.failed,
    }));

    res.json({
      window: `${days}d`,
      activeZaps: zaps.filter((zap) => zap.active).length,
      totalZaps: zaps.length,
      runCounts: counts,
      totalRuns: Object.values(counts).reduce((sum, value) => sum + value, 0),
      averageLatencyMs,
      runsPerDay,
      failedRuns: failedRuns.map((r) => ({
        id: r.id,
        zapId: r.zapId,
        zapName: r.zap?.name ?? null,
        error: r.error,
        createdAt: r.createdAt,
      })),
      suspendedRuns: suspendedRuns.map((r) => ({
        id: r.id,
        zapId: r.zapId,
        zapName: r.zap?.name ?? null,
        resumeAt: r.resumeAt,
        createdAt: r.createdAt,
      })),
      zaps,
      recentRuns: recent,
    });
  });

  return router;
}
