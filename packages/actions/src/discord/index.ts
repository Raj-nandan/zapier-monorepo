import { z } from "zod";
import type { ActionHandler, ActionRunInput, ActionOutcome } from "../types";

export const slug = "discord";

export const schema = z
  .object({
    url: z.string().url(),
    body: z.string().default(""),
  })
  .passthrough();

export type DiscordMetadata = z.infer<typeof schema>;

export const fields = [
  {
    key: "url",
    label: "Webhook URL",
    type: "url" as const,
    required: true,
    placeholder: "https://discord.com/api/webhooks/...",
  },
  { key: "body", label: "Content", type: "textarea" as const, required: true, placeholder: "Message" },
];

export class DiscordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function run(input: {
  metadata: DiscordMetadata;
  fetchImpl?: FetchLike;
}): Promise<ActionOutcome> {
  const doFetch = input.fetchImpl ?? fetch;
  const response = await doFetch(input.metadata.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: input.metadata.body ?? "" }),
  });

  if (!response.ok) {
    throw new DiscordError(`discord returned ${response.status}`);
  }

  return { kind: "success", output: { delivered: true } };
}

export const handler: ActionHandler = {
  slug,
  schema: schema as unknown as ActionHandler["schema"],
  fields,
  run: (input: ActionRunInput) => run(input as { metadata: DiscordMetadata }),
};
