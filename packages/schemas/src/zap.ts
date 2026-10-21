import { z } from "zod";

export const MAX_PAYLOAD_BYTES = 1048576;
export const MAX_SUBSTITUTIONS = 100;
export const MAX_OUTPUT_BYTES = 10240;
export const MAX_PARSE_DEPTH = 5;

const REF_TOKEN = /\{\{([^{}]*)\}\}/g;
const REF_SHAPE = /^(?:trigger|[A-Za-z_][A-Za-z0-9_]*)\.output(?:\.[A-Za-z0-9_*.-]+)*$/;

export function collectStrings(value: unknown, acc: string[] = [], depth = 0): string[] {
  if (depth > MAX_PARSE_DEPTH) return acc;
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc, depth + 1);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, acc, depth + 1);
  }
  return acc;
}

export function extractRefs(strings: string[]): string[] {
  const refs: string[] = [];
  for (const str of strings) {
    for (const match of str.matchAll(REF_TOKEN)) {
      refs.push(match[1].trim());
    }
  }
  return refs;
}

export function availableRefs(priorStepCount: number): string[] {
  const refs = ["trigger"];
  for (let i = 1; i <= priorStepCount; i++) refs.push(`step${i}`);
  return refs;
}

export function validateRefs(
  metadata: unknown,
  priorStepCount: number,
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  const allowed = new Set(availableRefs(priorStepCount));
  let substitutions = 0;

  for (const str of collectStrings(metadata)) {
    for (const ref of extractRefs([str])) {
      substitutions++;
      if (!REF_SHAPE.test(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `Invalid template reference: {{${ref}}}`,
        });
        continue;
      }
      const root = ref.split(".")[0];
      if (!allowed.has(root)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `Unknown template reference: {{${ref}}}`,
        });
      }
    }
  }

  if (substitutions > MAX_SUBSTITUTIONS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: `Too many template substitutions: ${substitutions} > ${MAX_SUBSTITUTIONS}`,
    });
  }
}

export function enforceSizeCap(input: unknown, ctx: z.RefinementCtx): void {
  const size = Buffer.byteLength(JSON.stringify(input) ?? "", "utf8");
  if (size > MAX_PAYLOAD_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Payload too large: ${size} > ${MAX_PAYLOAD_BYTES} bytes`,
    });
  }
}
const actionSchema = z.object({
  availableActionId: z.string().min(1),
  actionMetadata: z.record(z.any()).default({}),
  connectionId: z.string().optional(),
});

export const zapCreateSchema = z
  .object({
    name: z.string().optional(),
    folderId: z.string().optional(),
    availableTriggerId: z.string().min(1),
    triggerMetadata: z.record(z.any()).default({}),
    actions: z.array(actionSchema).min(1),
  })  .superRefine((val, ctx) => {
    enforceSizeCap(val, ctx);
    validateRefs(val.triggerMetadata, 0, ["triggerMetadata"], ctx);
    val.actions.forEach((action, index) => {
      validateRefs(action.actionMetadata, index, ["actions", index, "actionMetadata"], ctx);
    });
  });

export const zapUpdateSchema = z
  .object({
    folderId: z.string().optional(),
    availableTriggerId: z.string().min(1),
    triggerMetadata: z.record(z.any()).default({}),
    actions: z.array(actionSchema).min(1),
    name: z.string().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    enforceSizeCap(val, ctx);
    validateRefs(val.triggerMetadata, 0, ["triggerMetadata"], ctx);
    val.actions.forEach((action, index) => {
      validateRefs(action.actionMetadata, index, ["actions", index, "actionMetadata"], ctx);
    });
  });

export const testTriggerSchema = z.object({
  availableTriggerId: z.string().min(1),
  triggerMetadata: z.record(z.any()).default({}),
  connectionId: z.string().optional(),
});

export const replaySchema = z.object({
  idempotencyKey: z.string().uuid().optional(),
});

export type ZapCreate = z.infer<typeof zapCreateSchema>;
export type ZapUpdate = z.infer<typeof zapUpdateSchema>;
