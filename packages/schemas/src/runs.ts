import { z } from "zod";

export const runsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["PENDING", "RUNNING", "SUCCESS", "FAILED", "SKIPPED", "SUSPENDED"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RunsQuery = z.infer<typeof runsQuerySchema>;
