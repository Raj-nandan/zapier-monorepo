import { z } from "zod";
import { env } from "@repo/config";
import type { ActionHandler, ActionRunInput, ActionOutcome } from "../types";

export const slug = "slack";

export const SLACK_POST_MESSAGE = "https://slack.com/api/chat.postMessage";

export const schema = z
  .object({
    to: z.string().min(1),
    body: z.string().default(""),
    connectionId: z.string().optional(),
  })
  .passthrough();

export type SlackMetadata = z.infer<typeof schema>;

export const fields = [
  { key: "to", label: "Channel", type: "text" as const, required: true, placeholder: "#general" },
  { key: "body", label: "Text", type: "textarea" as const, required: true, placeholder: "Message" },
];

export class SlackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function run(input: {
  metadata: SlackMetadata;
  token?: string;
  fetchImpl?: FetchLike;
}): Promise<ActionOutcome> {
  const token = input.token ?? env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new SlackError("slack bot token is not configured");
  }

  const doFetch = input.fetchImpl ?? fetch;
  const response = await doFetch(SLACK_POST_MESSAGE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: input.metadata.to, text: input.metadata.body ?? "" }),
  });

  if (!response.ok) {
    throw new SlackError(`slack returned ${response.status}`);
  }

  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (payload.ok === false) {
    throw new SlackError(`slack rejected the message: ${payload.error ?? "unknown"}`);
  }

  return { kind: "success", output: { channel: input.metadata.to, delivered: true } };
}

export const handler: ActionHandler = {
  slug,
  schema: schema as unknown as ActionHandler["schema"],
  fields,
  run: (input: ActionRunInput) => run(input as { metadata: SlackMetadata }),
};
