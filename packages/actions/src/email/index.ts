import nodemailer from "nodemailer";
import { z } from "zod";
import { env } from "@repo/config";
import type { ActionHandler, ActionRunInput, ActionOutcome } from "../types";

export const slug = "email";

export const schema = z
  .object({
    to: z.string().min(1),
    subject: z.string().default(""),
    body: z.string().default(""),
    connectionId: z.string().optional(),
  })
  .passthrough();

export type EmailMetadata = z.infer<typeof schema>;

export const fields = [
  { key: "to", label: "To", type: "text" as const, required: true, placeholder: "a@b.com" },
  {
    key: "subject",
    label: "Subject",
    type: "text" as const,
    required: false,
    placeholder: "Subject line",
  },
  {
    key: "body",
    label: "Body",
    type: "textarea" as const,
    required: false,
    placeholder: "Message body",
  },
];

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailError";
  }
}

export type Transport = {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<{ messageId?: string }>;
};

export function createTransport(): Transport {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    throw new EmailError("smtp is not configured");
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: Number(env.SMTP_PORT || 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  }) as unknown as Transport;
}

export async function run(input: {
  metadata: EmailMetadata;
  transport?: Transport;
  from?: string;
}): Promise<ActionOutcome> {
  const transport = input.transport ?? createTransport();
  const from = input.from ?? env.SMTP_USER;

  if (!from) {
    throw new EmailError("no sender address configured");
  }

  const info = await transport.sendMail({
    from,
    to: input.metadata.to,
    subject: input.metadata.subject ?? "",
    text: input.metadata.body ?? "",
  });

  return { kind: "success", output: { messageId: info.messageId ?? null } };
}

export const handler: ActionHandler = {
  slug,
  schema: schema as unknown as ActionHandler["schema"],
  fields,
  run: (input: ActionRunInput) => run(input as { metadata: EmailMetadata }),
};
