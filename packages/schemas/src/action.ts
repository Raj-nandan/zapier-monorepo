import { z } from "zod";

export const actionMetadataSchema = z.object({
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  url: z.string().optional(),
  method: z.string().optional(),
  headers: z.record(z.string()).optional(),
  bodyTemplate: z.string().optional(),
  ms: z.number().int().positive().optional(),
  condition: z.string().optional(),
  connectionId: z.string().optional(),
});

export type ActionMetadata = z.infer<typeof actionMetadataSchema>;
