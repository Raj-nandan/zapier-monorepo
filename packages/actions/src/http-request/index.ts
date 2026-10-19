import { z } from "zod";
import {
  assertSafeUrl,
  MAX_RESPONSE_BYTES,
  REQUEST_TIMEOUT_MS,
  SsrfError,
  type ResolveHost,
} from "../lib/ssrf";
import type { ActionHandler, ActionRunInput, ActionOutcome } from "../types";

export const slug = "http-request";

export const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;

export const schema = z
  .object({
    url: z.string().url(),
    method: z.enum(ALLOWED_METHODS).default("GET"),
    headers: z.record(z.string()).optional(),
    bodyTemplate: z.string().optional(),
    timeoutMs: z.number().int().positive().max(REQUEST_TIMEOUT_MS).optional(),
    allowlist: z.array(z.string()).optional(),
  })
  .passthrough();

export type HttpRequestMetadata = z.infer<typeof schema>;

export const fields = [
  { key: "url", label: "URL", type: "url" as const, required: true, placeholder: "https://api.example.com" },
  { key: "method", label: "Method", type: "select" as const, required: true, options: [...ALLOWED_METHODS] },
  { key: "headers", label: "Headers", type: "textarea" as const, required: false },
  { key: "bodyTemplate", label: "Body", type: "textarea" as const, required: false },
];

export class HttpRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function readCapped(response: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new HttpRequestError(`response exceeds ${maxBytes} bytes`);
  }
  return body;
}

export async function run(input: {
  metadata: HttpRequestMetadata;
  fetchImpl?: FetchLike;
  resolveHost?: ResolveHost;
  now?: () => number;
}): Promise<ActionOutcome> {
  const { url, method, headers, bodyTemplate } = input.metadata;
  const doFetch = input.fetchImpl ?? fetch;
  const timeoutMs = input.metadata.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const now = input.now ?? (() => Date.now());

  const safeUrl = await assertSafeUrl(url, {
    allowlist: input.metadata.allowlist,
    resolveHost: input.resolveHost,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(safeUrl.toString(), {
      method,
      headers: { accept: "application/json", ...(headers ?? {}) },
      body: bodyTemplate,
      signal: controller.signal,
    });

    const text = await readCapped(response);

    if (!response.ok) {
      throw new HttpRequestError(`request failed with ${response.status}`);
    }

    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    return {
      kind: "success",
      output: { status: response.status, body: parsed as Record<string, unknown> },
    };
  } catch (error) {
    if (error instanceof SsrfError) throw error;
    if (error instanceof HttpRequestError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new HttpRequestError(`request exceeded ${timeoutMs} ms`);
    }
    throw new HttpRequestError((error as Error).message);
  } finally {
    clearTimeout(timer);
    now();
  }
}

export const handler: ActionHandler = {
  slug,
  schema: schema as unknown as ActionHandler["schema"],
  fields,
  run: (input: ActionRunInput) => run(input as { metadata: HttpRequestMetadata }),
};
