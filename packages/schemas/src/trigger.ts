import { z } from "zod";

export const triggerMetadataSchema = z.object({
  cron: z.string().optional(),
  connectionId: z.string().optional(),
  cursor: z.string().optional(),
});

export type TriggerMetadata = z.infer<typeof triggerMetadataSchema>;
