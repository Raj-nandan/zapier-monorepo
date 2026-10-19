import type { z } from "zod";
import type { ServerAppConnection } from "@repo/schemas";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "url"
  | "select"
  | "boolean";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface TriggerSampleInput<M = Record<string, unknown>> {
  metadata: M;
  connection?: ServerAppConnection;
}

export interface TriggerHandler<M = Record<string, unknown>> {
  slug: string;
  schema: z.ZodType<M>;
  fields: FieldSpec[];
  fetchSample(input: TriggerSampleInput<M>): Promise<unknown[]>;
}

export type AnyTriggerHandler = {
  slug: string;
  schema: z.ZodTypeAny;
  fields: FieldSpec[];
  fetchSample(input: TriggerSampleInput): Promise<unknown[]>;
};

export type TriggerRegistry = Map<string, AnyTriggerHandler>;

export class UnknownTriggerError extends Error {
  constructor(slug: string) {
    super(`unknown trigger handler: ${slug}`);
    this.name = "UnknownTriggerError";
  }
}

export class DuplicateTriggerError extends Error {
  constructor(slug: string) {
    super(`duplicate trigger handler: ${slug}`);
    this.name = "DuplicateTriggerError";
  }
}

export function createRegistry(handlers: readonly AnyTriggerHandler[]): TriggerRegistry {
  const registry: TriggerRegistry = new Map();
  for (const handler of handlers) {
    if (registry.has(handler.slug)) {
      throw new DuplicateTriggerError(handler.slug);
    }
    registry.set(handler.slug, handler);
  }
  return registry;
}

export function getHandler(registry: TriggerRegistry, slug: string): AnyTriggerHandler {
  const handler = registry.get(slug);
  if (!handler) {
    throw new UnknownTriggerError(slug);
  }
  return handler;
}

export function hasHandler(registry: TriggerRegistry, slug: string): boolean {
  return registry.has(slug);
}

export function listHandlers(registry: TriggerRegistry): AnyTriggerHandler[] {
  return [...registry.values()];
}
