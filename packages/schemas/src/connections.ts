import { z } from "zod";

export const connectionSchema = z.object({
  app: z.enum(["gmail", "github"]),
  accountLabel: z.string().optional(),
});

export type Connection = z.infer<typeof connectionSchema>;

export type ConnectionApp = Connection["app"];

export interface ServerAppConnection {
  id: string;
  app: ConnectionApp;
  accountLabel: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}
