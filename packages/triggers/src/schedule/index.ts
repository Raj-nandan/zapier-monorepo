import { Cron } from "croner";
import { z } from "zod";
import type { TriggerHandler } from "../types";

export const slug = "schedule";

export const CRON_TIMEZONE = "UTC";

export const schema = z
  .object({
    cron: z.string().min(1),
    connectionId: z.string().optional(),
    cursor: z.string().optional(),
  })
  .passthrough();

export const fields = [
  {
    key: "cron",
    label: "Cron (UTC)",
    type: "text" as const,
    required: true,
    placeholder: "*/5 * * * *",
  },
];

export function isValidCron(expression: string): boolean {
  try {
    return new Cron(expression, { paused: true, timezone: CRON_TIMEZONE }).nextRun() !== null;
  } catch {
    return false;
  }
}

export function nextRunAt(expression: string, from: Date = new Date()): Date | null {
  try {
    return new Cron(expression, { paused: true, timezone: CRON_TIMEZONE }).nextRun(from) ?? null;
  } catch {
    return null;
  }
}

export async function fetchSample(input: {
  metadata: z.infer<typeof schema>;
}): Promise<unknown[]> {
  const now = new Date();
  const next = nextRunAt(input.metadata.cron, now);
  return [
    {
      source: slug,
      firedAt: now.toISOString(),
      nextRunAt: next ? next.toISOString() : null,
    },
  ];
}

export const handler: TriggerHandler<z.infer<typeof schema>> = {
  slug,
  schema,
  fields,
  fetchSample,
};
