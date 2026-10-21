"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Run = {
  id: string;
  zapId: string;
  zapName: string;
  status: string;
  took?: string;
  started?: string;
  createdAt?: string;
};

type RunDetail = {
  id: string;
  zapName: string;
  status: string;
  started: string;
  steps: { title: string; time: string; code: string; error?: string; status: string }[];
};

async function fetchRuns(params: { search?: string; status?: string; cursor?: string }): Promise<{ runs: Run[]; nextCursor?: string | null }> {
  const q = new URLSearchParams();
  q.set("limit", "25");
  if (params.search) q.set("search", params.search);
  if (params.status && params.status !== "ALL") q.set("status", params.status);
  if (params.cursor) q.set("cursor", params.cursor);
  const res = await apiFetch(`/runs?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load runs");
  const data = await res.json();
  return { runs: data.runs ?? data ?? [], nextCursor: data.nextCursor ?? null };
}

async function fetchRunDetail(id: string): Promise<RunDetail> {
  const res = await apiFetch(`/runs/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load run");
  return res.json();
}

async function replayRun(id: string) {
  const res = await apiFetch(`/runs/${id}/replay`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to replay");
  return res.json();
}

const statusVariant: Record<string, "success" | "failed" | "running" | "suspended" | "neutral"> = {
  SUCCESS: "success",
  FAILED: "failed",
  RUNNING: "running",
  SUSPENDED: "suspended",
  PENDING: "neutral",
  SKIPPED: "neutral",
};

export default function HistoryPage() {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["runs", search, status, cursor],
    queryFn: () => fetchRuns({ search, status, cursor: cursor ?? undefined }),
  });
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["run", selectedRun],
    queryFn: () => fetchRunDetail(selectedRun!),
    enabled: !!selectedRun,
  });

  const runs = data?.runs ?? [];
  const nextCursor = data?.nextCursor ?? null;

  const handleReplay = async (id: string) => {
    try {
      const result = await replayRun(id);
      toast.success(`Replay started as run ${result.id ?? result.zapRunId ?? ""}`);
      refetch();
    } catch {
      toast.error("Replay failed. Please try again.");
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Copied");
  };

  return (
    <AppShell active="/history">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Run history</h1>
          <p className="text-sm text-ink-3">Every run and its steps. Kept for 90 days.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search by Zap name" className="h-8 w-48" value={search} onChange={(e) => { setSearch(e.target.value); setCursor(null); setCursorStack([]); }} />
          <select className="h-8 rounded-sm border border-line-strong bg-surface px-3 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setCursor(null); setCursorStack([]); }}>
            <option value="ALL">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="RUNNING">Running</option>
            <option value="PENDING">Pending</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        <div className="flex gap-4">
          <Card className="flex-1">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 text-sm text-ink-3">Loading runs…</div>
              ) : runs.length === 0 ? (
                <div className="p-6 text-sm text-ink-3">
                  No runs yet. Fire the webhook or run a test — runs appear here. History is kept for 90 days.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
                          <th className="px-4 py-3">Run</th>
                          <th className="px-4 py-3">Automation</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Took</th>
                          <th className="px-4 py-3">Started</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((run) => (
                          <tr
                            key={run.id}
                            onClick={() => setSelectedRun(run.id)}
                            className={`cursor-pointer border-b border-line last:border-0 hover:bg-sunken ${
                              selectedRun === run.id ? "bg-flame-50" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-ink-3">{run.id}</td>
                            <td className="px-4 py-3 font-medium text-ink">{run.zapName}</td>
                            <td className="px-4 py-3">
                              <Badge variant={statusVariant[run.status] ?? "neutral"}>{run.status}</Badge>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-ink-3">{run.took ?? "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-ink-3">{run.started ?? run.createdAt ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-4 py-3">
                    <span className="text-xs text-ink-3">{runs.length} runs · runs are kept for 90 days</span>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" disabled={cursorStack.length === 0} onClick={() => { const prev = cursorStack[cursorStack.length - 1]; setCursorStack((s) => s.slice(0, -1)); setCursor(prev ?? null); }}>Previous</Button>
                      <Button variant="secondary" size="sm" disabled={!nextCursor} onClick={() => { if (nextCursor) { setCursorStack((s) => (cursor ? [...s, cursor] : s)); setCursor(nextCursor); } }}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {selectedRun && (
            <div className="w-[480px] shrink-0 rounded-xl border border-line bg-surface shadow-sm">
              {detailLoading ? (
                <div className="p-6 text-sm text-ink-3">Loading…</div>
              ) : !detail ? (
                <div className="p-6 text-sm text-ink-3">Run not found.</div>
              ) : (
                <>
                  <div className="border-b border-line p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-ink">{detail.zapName}</h3>
                        <p className="font-mono text-xs text-ink-3">{detail.id} · started {detail.started}</p>
                      </div>
                      <Badge variant={statusVariant[detail.status] ?? "neutral"}>{detail.status}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {detail.status === "FAILED" && (
                        <Button size="sm" onClick={() => handleReplay(detail.id)}>Retry run</Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => handleCopyId(detail.id)}>Copy ID</Button>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="relative space-y-4">
                      {detail.steps?.map((step, i) => (
                        <div key={i} className="relative pl-8">
                          <div className={`absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full ${
                            step.status === "SUCCESS" ? "bg-status-success-bg text-status-success" :
                            step.status === "FAILED" ? "bg-status-failed-bg text-status-failed" :
                            "bg-status-running-bg text-status-running"
                          }`}>
                            {step.status === "SUCCESS" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                            {step.status === "FAILED" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>}
                            {step.status === "RUNNING" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.6" /></svg>}
                          </div>
                          {i < (detail.steps?.length ?? 0) - 1 && (
                            <div className="absolute left-2.5 top-6 h-full w-px bg-line" />
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-ink">{step.title}</span>
                            <span className="font-mono text-xs text-ink-3">{step.time}</span>
                          </div>
                          {step.error && (
                            <div className="mt-2 rounded-sm bg-status-failed-bg p-3 ring-1 ring-status-failed/20">
                              <p className="text-xs text-status-failed">{step.error}</p>
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => handleReplay(detail.id)}>Retry from this step</Button>
                                <button className="text-xs font-medium text-status-failed">Check connection</button>
                              </div>
                            </div>
                          )}
                          <div className="mt-2 rounded-sm bg-sunken px-3 py-2 font-mono text-[11px] text-ink-3 truncate">{step.code}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
