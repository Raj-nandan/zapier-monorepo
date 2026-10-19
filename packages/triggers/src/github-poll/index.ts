import { z } from "zod";
import type { ServerAppConnection, TriggerMetadata } from "@repo/schemas";
import type { TriggerHandler } from "../types";

export const slug = "github-poll";

export interface GithubIssue {
  id: string;
  number: number;
  title: string;
  state: string;
  url: string;
  updatedAt: string;
}

export const schema = z
  .object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    connectionId: z.string().optional(),
    cursor: z.string().optional(),
  })
  .passthrough();

export type GithubMetadata = z.infer<typeof schema>;

export const fields = [
  {
    key: "owner",
    label: "Owner",
    type: "text" as const,
    required: true,
    placeholder: "octocat",
  },
  {
    key: "repo",
    label: "Repository",
    type: "text" as const,
    required: true,
    placeholder: "hello-world",
  },
];

export class GithubPollError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubPollError";
  }
}

function requireConnection(connection?: ServerAppConnection): ServerAppConnection {
  if (!connection) {
    throw new GithubPollError("github-poll requires a github ConnectedAccount");
  }
  if (connection.app !== "github") {
    throw new GithubPollError(`expected a github connection, received ${connection.app}`);
  }
  if (!connection.accessToken) {
    throw new GithubPollError("github connection has no access token");
  }
  return connection;
}

export function toIssue(raw: unknown): GithubIssue {
  const item = raw as {
    id?: number;
    number?: number;
    title?: string;
    state?: string;
    html_url?: string;
    updated_at?: string;
  };
  return {
    id: String(item.id ?? ""),
    number: item.number ?? 0,
    title: item.title ?? "",
    state: item.state ?? "",
    url: item.html_url ?? "",
    updatedAt: item.updated_at ?? "",
  };
}

export function itemsAfterCursor(items: GithubIssue[], cursor?: string): GithubIssue[] {
  if (!cursor) return items;
  return items.filter((item) => Number(item.id) > Number(cursor));
}

export function advanceCursor(items: GithubIssue[], previous?: string | null): string | null {
  const ids = items.map((item) => Number(item.id)).filter((id) => Number.isFinite(id));
  if (ids.length === 0) return previous ?? null;
  const max = Math.max(...ids);
  if (previous && Number(previous) >= max) return previous;
  return String(max);
}

export async function fetchSample(input: {
  metadata: GithubMetadata & TriggerMetadata;
  connection?: ServerAppConnection;
}): Promise<GithubIssue[]> {
  const connection = requireConnection(input.connection);
  const { owner, repo, cursor } = input.metadata;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&per_page=100`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "zapier-monorepo",
    },
  });

  if (!response.ok) {
    throw new GithubPollError(`github api returned ${response.status}`);
  }

  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new GithubPollError("github api did not return a list");
  }

  const items = body.map(toIssue).sort((a, b) => Number(a.id) - Number(b.id));
  return itemsAfterCursor(items, cursor);
}

export const handler: TriggerHandler<GithubMetadata> = {
  slug,
  schema,
  fields,
  fetchSample,
};
