import { z } from "zod";
import type { ActionHandler, ActionRunInput, ActionOutcome } from "../types";

export const slug = "filter";

export const schema = z
  .object({
    condition: z.string().min(1),
  })
  .passthrough();

export type FilterMetadata = z.infer<typeof schema>;

export const fields = [
  {
    key: "condition",
    label: "Condition",
    type: "text" as const,
    required: true,
    placeholder: "trigger.output.count > 10",
  },
];

export class FilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FilterError";
  }
}

export type Operand =
  | { kind: "literal"; value: string }
  | { kind: "path"; value: string };

export type Operator = "==" | "!=" | ">" | ">=" | "<" | "<=" | "contains";

export interface Condition {
  left: Operand;
  operator: Operator;
  right: Operand;
}

const OPERATORS: Operator[] = ["==", "!=", ">=", "<=", ">", "<", "contains"];

export function parseCondition(expression: string): Condition {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new FilterError("condition is empty");
  }

  for (const operator of OPERATORS) {
    const index = trimmed.indexOf(` ${operator} `);
    if (index === -1) continue;

    const left = trimmed.slice(0, index).trim();
    const right = trimmed.slice(index + operator.length + 2).trim();
    if (!left || !right) {
      throw new FilterError(`malformed condition: ${expression}`);
    }
    return { left: toOperand(left), operator, right: toOperand(right) };
  }

  throw new FilterError(
    `unsupported condition: ${expression} (expected one of ${OPERATORS.join(", ")})`,
  );
}

function toOperand(token: string): Operand {
  const unquoted = token.replace(/^["']|["']$/g, "");
  if (unquoted.includes(".")) {
    return { kind: "path", value: unquoted };
  }
  return { kind: "literal", value: unquoted };
}

export function resolveOperand(
  operand: Operand,
  context: Record<string, unknown>,
): unknown {
  if (operand.kind === "literal") return operand.value;
  const segments = operand.value.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function evaluate(condition: Condition, context: Record<string, unknown>): boolean {
  const left = resolveOperand(condition.left, context);
  const right = resolveOperand(condition.right, context);

  if (condition.operator === "contains") {
    return String(left ?? "").includes(String(right ?? ""));
  }

  if (condition.operator === "==") return String(left ?? "") === String(right ?? "");
  if (condition.operator === "!=") return String(left ?? "") !== String(right ?? "");

  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber === null || rightNumber === null) return false;

  switch (condition.operator) {
    case ">":
      return leftNumber > rightNumber;
    case ">=":
      return leftNumber >= rightNumber;
    case "<":
      return leftNumber < rightNumber;
    case "<=":
      return leftNumber <= rightNumber;
  }
}

export async function run(input: {
  metadata: FilterMetadata;
  context: Record<string, unknown>;
}): Promise<ActionOutcome> {
  const parsed = parseCondition(input.metadata.condition);
  if (evaluate(parsed, input.context)) {
    return { kind: "success", output: { matched: true } };
  }
  return { kind: "skip", reason: `condition not met: ${input.metadata.condition}` };
}

export const handler: ActionHandler = {
  slug,
  schema: schema as unknown as ActionHandler["schema"],
  fields,
  run: (input: ActionRunInput) =>
    run(input as { metadata: FilterMetadata; context: Record<string, unknown> }),
};
