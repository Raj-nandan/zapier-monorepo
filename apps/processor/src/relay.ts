import { prisma } from "@repo/db";

export const POLL_INTERVAL_MS = 1000;
export const BATCH_LIMIT = 100;
export const MAX_ATTEMPTS = 10;
export const MAX_BACKOFF_SECONDS = 300;

export interface OutboxRow {
  id: string;
  zapId: string;
  zapRunId: string;
  attempts: number;
  zapRevision: number;
}

export interface PublishMessage {
  zapRunId: string;
  zapId: string;
  zapRevision: number;
  attempt: number;
}

export interface RelayPublisher {
  publish(message: PublishMessage): Promise<void>;
  publishDeadLetter(message: PublishMessage): Promise<void>;
}

export function backoffSeconds(attempts: number): number {
  return Math.min(2 ** attempts, MAX_BACKOFF_SECONDS);
}

export async function claimBatch(limit = BATCH_LIMIT): Promise<OutboxRow[]> {
  return prisma.$queryRawUnsafe<OutboxRow[]>(
    `SELECT o.id, o."zapId", o."zapRunId", o.attempts, r."zapRevision"
       FROM "ZapRunOutbox" o
       JOIN "ZapRun" r ON r.id = o."zapRunId"
      WHERE o."nextRetryAt" <= now()
      ORDER BY o."createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}`,
  );
}

export async function runOnce(publisher: RelayPublisher, limit = BATCH_LIMIT): Promise<number> {
  const rows = await claimBatch(limit);
  let published = 0;

  for (const row of rows) {
    const message: PublishMessage = {
      zapRunId: row.zapRunId,
      zapId: row.zapId,
      zapRevision: row.zapRevision,
      attempt: row.attempts,
    };
    try {
      await publisher.publish(message);
      await prisma.zapRunOutbox.delete({ where: { id: row.id } });
      published++;
    } catch (error) {
      const attempts = row.attempts + 1;
      if (attempts > MAX_ATTEMPTS) {
        try {
          await publisher.publishDeadLetter(message);
        } finally {
          await prisma.zapRunOutbox.delete({ where: { id: row.id } });
        }
        await prisma.zapRun.update({
          where: { id: row.zapRunId },
          data: { status: "FAILED", error: `relay failed after ${attempts} attempts` },
        });
        continue;
      }
      await prisma.zapRunOutbox.update({
        where: { id: row.id },
        data: {
          attempts,
          nextRetryAt: new Date(Date.now() + backoffSeconds(attempts) * 1000),
        },
      });
    }
  }

  return published;
}

export async function pollForever(
  publisher: RelayPublisher,
  options: { intervalMs?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const interval = options.intervalMs ?? POLL_INTERVAL_MS;
  const limit = options.limit ?? BATCH_LIMIT;

  while (!options.signal?.aborted) {
    try {
      await runOnce(publisher, limit);
    } catch {
      // keep polling; a broker outage should delay delivery, not stop the relay
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
