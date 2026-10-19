import type { z } from "zod";
import type { ActionMetadata, ServerAppConnection } from "@repo/schemas";

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

export type ActionOutcome =
  | { kind: "success"; output: Record<string, unknown> }
  | { kind: "skip"; reason: string }
  | { kind: "suspend"; resumeAt: Date; reason?: string };

export interface ActionRunInput {
  metadata: ActionMetadata;
  connection?: ServerAppConnection;
  context: Record<string, unknown>;
}

export interface ActionHandler {
  slug: string;
  schema: z.ZodTypeAny;
  fields: FieldSpec[];
  run(input: ActionRunInput): Promise<ActionOutcome>;
}

export type ActionRegistry = Map<string, ActionHandler>;

export class UnknownActionError extends Error {
  constructor(slug: string) {
    super(`unknown action handler: ${slug}`);
    this.name = "UnknownActionError";
  }
}

export class DuplicateActionError extends Error {
  constructor(slug: string) {
    super(`duplicate action handler: ${slug}`);
    this.name = "DuplicateActionError";
  }
}

export function createRegistry(handlers: readonly ActionHandler[]): ActionRegistry {
  const registry: ActionRegistry = new Map();
  for (const handler of handlers) {
    if (registry.has(handler.slug)) {
      throw new DuplicateActionError(handler.slug);
    }
    registry.set(handler.slug, handler);
  }
  return registry;
}

export function getHandler(registry: ActionRegistry, slug: string): ActionHandler {
  const handler = registry.get(slug);
  if (!handler) {
    throw new UnknownActionError(slug);
  }
  return handler;
}

export function hasHandler(registry: ActionRegistry, slug: string): boolean {
  return registry.has(slug);
}

export function listHandlers(registry: ActionRegistry): ActionHandler[] {
  return [...registry.values()];
}
