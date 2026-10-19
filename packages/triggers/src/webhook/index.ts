import { z } from "zod";
import type { TriggerHandler } from "../types";

export const slug = "webhook";

export const schema = z.object({}).passthrough();

export const fields = [];

export async function fetchSample(): Promise<unknown[]> {
  return [];
}

export const handler: TriggerHandler<z.infer<typeof schema>> = {
  slug,
  schema,
  fields,
  fetchSample,
};
