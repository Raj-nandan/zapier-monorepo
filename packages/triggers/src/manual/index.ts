import { z } from "zod";
import type { TriggerHandler } from "../types";

export const slug = "manual";

export const schema = z
  .object({
    message: z.string().min(1).max(1000).optional(),
  })
  .passthrough();

export const fields = [
  {
    key: "message",
    label: "Message",
    type: "text" as const,
    required: false,
    placeholder: "Sample payload text",
  },
];

export async function fetchSample(input: {
  metadata: z.infer<typeof schema>;
}): Promise<unknown[]> {
  const message = input.metadata.message ?? "manual trigger sample";
  return [{ source: slug, message, firedAt: new Date().toISOString() }];
}

export const handler: TriggerHandler<z.infer<typeof schema>> = {
  slug,
  schema,
  fields,
  fetchSample,
};
