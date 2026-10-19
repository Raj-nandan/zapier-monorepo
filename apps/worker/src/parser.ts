export const MAX_DEPTH = 5;
export const MAX_SUBSTITUTIONS = 100;
export const MAX_OUTPUT_BYTES = 10240;

export class ParserError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "ParserError";
    this.reason = reason;
  }
}

const TOKEN = /\{\{([^{}]*)\}\}/g;

export function extractTokens(input: string): string[] {
  const tokens: string[] = [];
  for (const match of input.matchAll(TOKEN)) {
    tokens.push(match[1].trim());
    if (tokens.length > MAX_SUBSTITUTIONS) {
      throw new ParserError(`too many substitutions: limit is ${MAX_SUBSTITUTIONS}`);
    }
  }
  return tokens;
}

export function resolvePath(context: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function stringDepth(value: unknown, depth = 0): number {
  if (depth > MAX_DEPTH) return depth;
  if (Array.isArray(value)) {
    return value.reduce((max, item) => Math.max(max, stringDepth(item, depth + 1)), depth);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce(
      (max, item) => Math.max(max, stringDepth(item, depth + 1)),
      depth,
    );
  }
  return depth;
}

export function render(input: string, context: Record<string, unknown>): string {
  let substitutions = 0;
  const output = input.replace(TOKEN, (_match, raw: string) => {
    substitutions++;
    if (substitutions > MAX_SUBSTITUTIONS) {
      throw new ParserError(`too many substitutions: limit is ${MAX_SUBSTITUTIONS}`);
    }
    const path = raw.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_*-]+)*$/.test(path)) {
      throw new ParserError(`invalid reference: {{${path}}}`);
    }
    const value = resolvePath(context, path);
    return value === undefined || value === null ? "" : String(value);
  });

  if (Buffer.byteLength(output, "utf8") > MAX_OUTPUT_BYTES) {
    throw new ParserError(`output exceeds ${MAX_OUTPUT_BYTES} bytes`);
  }
  return output;
}

export function renderMetadata(
  metadata: unknown,
  context: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) {
    throw new ParserError(`nesting exceeds depth ${MAX_DEPTH}`);
  }
  if (typeof metadata === "string") return render(metadata, context);
  if (Array.isArray(metadata)) {
    return metadata.map((item) => renderMetadata(item, context, depth + 1));
  }
  if (metadata && typeof metadata === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      result[key] = renderMetadata(value, context, depth + 1);
    }
    return result;
  }
  return metadata;
}

export function truncateStepPayload(value: unknown, limit = MAX_OUTPUT_BYTES): unknown {
  const serialised = JSON.stringify(value ?? null) ?? "null";
  if (Buffer.byteLength(serialised, "utf8") <= limit) return value;
  return { truncated: true, preview: serialised.slice(0, limit) };
}
