import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { ServerAppConnection, TriggerMetadata } from "@repo/schemas";
import type { TriggerHandler } from "../types";

export const slug = "rss-poll";

export interface RssItem {
  id: string;
  title: string;
  link: string;
  published: string | null;
}

export const schema = z
  .object({
    url: z.string().url(),
    connectionId: z.string().optional(),
    cursor: z.string().optional(),
  })
  .passthrough();

export type RssMetadata = z.infer<typeof schema>;

export const fields = [
  {
    key: "url",
    label: "Feed URL",
    type: "url" as const,
    required: true,
    placeholder: "https://example.com/feed.xml",
  },
];

export class RssPollError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RssPollError";
  }
}

export const MAX_FEED_BYTES = 1048576;

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)["#text"] ?? "");
  }
  return String(value);
}

function pickId(item: Record<string, unknown>, link: string, title: string): string {
  return text(item.guid) || link || title;
}

export function parseFeed(xml: string): RssItem[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = new XMLParser({ ignoreAttributes: false }).parse(xml) as Record<string, unknown>;
  } catch {
    throw new RssPollError("feed is not valid xml");
  }

  const rss = (parsed.rss as Record<string, unknown> | undefined) ?? undefined;
  const feed = (parsed.feed as Record<string, unknown> | undefined) ?? undefined;
  const channel = (rss?.channel as Record<string, unknown> | undefined) ?? undefined;

  if (!rss && !feed) {
    throw new RssPollError("document is not an rss or atom feed");
  }

  const rawItems = channel?.item ?? feed?.entry ?? [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  const items: RssItem[] = list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const title = text(item.title);
      const link = text(item.link) || text(item.guid) || text(item.id);
      const published = text(item.pubDate) || text(item.published) || text(item.updated) || null;
      return { id: pickId(item, link, title), title, link, published };
    })
    .filter((item) => item.id !== "");

  return items;
}

export function itemsAfterCursor(items: RssItem[], cursor?: string): RssItem[] {
  if (!cursor) return items;
  const index = items.findIndex((item) => item.id === cursor);
  if (index === -1) return items;
  return items.slice(index + 1);
}

export function advanceCursor(items: RssItem[], previous?: string | null): string | null {
  const last = items.at(-1);
  return last ? last.id : (previous ?? null);
}

export async function fetchSample(input: {
  metadata: RssMetadata & TriggerMetadata;
  connection?: ServerAppConnection;
}): Promise<RssItem[]> {
  const response = await fetch(input.metadata.url);

  if (!response.ok) {
    throw new RssPollError(`feed request returned ${response.status}`);
  }

  const xml = await response.text();
  if (Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) {
    throw new RssPollError(`feed exceeds ${MAX_FEED_BYTES} bytes`);
  }

  return itemsAfterCursor(parseFeed(xml), input.metadata.cursor);
}

export const handler: TriggerHandler<RssMetadata> = {
  slug,
  schema,
  fields,
  fetchSample,
};
