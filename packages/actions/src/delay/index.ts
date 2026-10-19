import { z } from "zod";
import type { ActionHandler, ActionRunInput, ActionOutcome } from "../types";

export const slug = "delay";

export const MAX_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

export const schema = z
  .object({
    ms: z.number().int().positive().max(MAX_DELAY_MS),
  })
  .passthrough();

export type DelayMetadata = z.infer<typeof schema>;

export const fields = [
  {
    key: "ms",
    label: "Delay (ms)",
    type: "number" as const,
    required: true,
    placeholder: "60000",
  },
];

export class DelayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DelayError";
  }
}

export function resumeAtFrom(ms: number, now: Date = new Date()): Date {
  if (!Number.isInteger(ms) || ms <= 0) {
    throw new DelayError(`delay must be a positive integer, received ${ms}`);
  }
  if (ms > MAX_DELAY_MS) {
    throw new DelayError(`delay exceeds ${MAX_DELAY_MS} ms`);
  }
  return new Date(now.getTime() + ms);
}

export async function run(input: {
  metadata: DelayMetadata;
  now?: Date;
}): Promise<ActionOutcome> {
  const now = input.now ?? new Date();
  return {
    kind: "suspend",
    resumeAt: resumeAtFrom(input.metadata.ms, now),
  };
}

export const handler: ActionHandler = {
  slug,
  schema: schema as unknown as ActionHandler["schema"],
  fields,
  run: (input: ActionRunInput) => run(input as { metadata: DelayMetadata }),
};
