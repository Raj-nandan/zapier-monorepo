import { z } from "zod";

export const zapEventPayloadSchema = z.object({
  zapRunId: z.string().min(1),
  zapId: z.string().min(1),
  zapRevision: z.number().int().positive(),
  attempt: z.number().int().nonnegative(),
});

export type ZapEventPayload = z.infer<typeof zapEventPayloadSchema>;

export function encodeZapEvent(payload: ZapEventPayload): Buffer {
  return Buffer.from(JSON.stringify(zapEventPayloadSchema.parse(payload)), "utf8");
}

export function decodeZapEvent(message: Buffer | null): ZapEventPayload {
  if (!message || message.length === 0) {
    throw new Error("empty zap-events message");
  }
  return zapEventPayloadSchema.parse(JSON.parse(message.toString("utf8")));
}
