import { prisma } from "@repo/db";
import { isValidCron, nextRunAt } from "@repo/triggers";

export const TICK_INTERVAL_MS = 30000;
export const BATCH_LIMIT = 100;

export interface TickResult {
  created: number;
  resumed: number;
  skippedInactive: number;
}

async function createRun(zapId: string, zapRevision: number, metadata: object): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const run = await tx.zapRun.create({
      data: { zapId, zapRevision, status: "PENDING", metadata },
    });
    await tx.zapRunOutbox.create({ data: { zapRunId: run.id, zapId } });
  });
}

export async function tick(): Promise<TickResult> {
  const result: TickResult = { created: 0, resumed: 0, skippedInactive: 0 };
  const now = new Date();

  const due = await prisma.trigger.findMany({
    where: { nextRunAt: { lte: now } },
    include: { zap: true },
    orderBy: { nextRunAt: "asc" },
    take: BATCH_LIMIT,
  });

  for (const trigger of due) {
    if (!trigger.zap.active) {
      result.skippedInactive++;
      continue;
    }

    const expression = (trigger.metadata as { cron?: string } | null)?.cron;
    if (!expression || !isValidCron(expression)) {
      continue;
    }

    await createRun(trigger.zapId, trigger.zap.revision, { trigger: "schedule" });
    await prisma.trigger.update({
      where: { id: trigger.id },
      data: { nextRunAt: nextRunAt(expression, now) },
    });
    result.created++;
  }

  const suspended = await prisma.zapRun.findMany({
    where: { status: "SUSPENDED", resumeAt: { lte: now } },
    take: BATCH_LIMIT,
  });

  for (const run of suspended) {
    await prisma.$transaction(async (tx) => {
      const reopened = await tx.zapRun.update({
        where: { id: run.id },
        data: { status: "PENDING", resumeAt: null },
      });
      await tx.zapRunOutbox.create({ data: { zapRunId: reopened.id, zapId: reopened.zapId } });
    });
    result.resumed++;
  }

  return result;
}

export async function pollForever(
  options: { intervalMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const interval = options.intervalMs ?? TICK_INTERVAL_MS;
  while (!options.signal?.aborted) {
    try {
      await tick();
    } catch {
      // a failed tick must not stop the scheduler
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
