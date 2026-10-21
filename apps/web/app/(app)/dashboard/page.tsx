"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Zap = {
  id: string;
  name: string;
  active: boolean;
  steps: number;
  lastRun?: string;
  status?: string;
};

type Dashboard = {
  activeZaps: number;
  totalZaps: number;
  totalRuns: number;
  runCounts: Record<string, number>;
  averageLatencyMs: number;
  runsPerDay: { date: string; succeeded: number; failed: number }[];
  failedRuns: { id: string; zapId: string; zapName: string; error: string; createdAt: string }[];
  suspendedRuns: { id: string; zapId: string; zapName: string }[];
};

async function fetchDashboard(window: string): Promise<Dashboard> {
  const res = await apiFetch(`/dashboard?window=${window}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

async function fetchZaps(search: string): Promise<Zap[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", "50");
  const res = await apiFetch(`/zap?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load zaps");
  const data = await res.json();
  return data.zaps ?? data ?? [];
}

async function toggleZap(id: string, active: boolean) {
  const res = await apiFetch(`/zap/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
  if (!res.ok) throw new Error("Failed to toggle");
  return res.json();
}

export default function DashboardPage() {
  const [window, setWindow] = useState("30d");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const queryClient = useQueryClient();

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ["dashboard", window],
    queryFn: () => fetchDashboard(window),
  });

  const { data: zaps = [], isLoading: zapsLoading } = useQuery({
    queryKey: ["zaps", search],
    queryFn: () => fetchZaps(search),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleZap(id, active),
    onSuccess: (_, { active }) => {
      toast.success(active ? "Automation turned on" : "Automation paused");
      queryClient.invalidateQueries({ queryKey: ["zaps"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      toast.error("Failed to toggle. Please try again.");
    },
  });

  const runCounts = dash?.runCounts ?? {};
  const totalRuns = dash?.totalRuns ?? 0;
  const successCount = runCounts.SUCCESS ?? 0;
  const successRate = totalRuns > 0 ? ((successCount / totalRuns) * 100).toFixed(1) + "%" : "—";
  const failedCount = runCounts.FAILED ?? 0;
  const activeZaps = dash?.activeZaps ?? 0;

  const stats = [
    { label: "Active automations", value: String(activeZaps) },
    { label: "Runs (30 days)", value: String(totalRuns) },
    { label: "Success rate", value: successRate },
    { label: "Failed runs", value: String(failedCount) },
  ];

  const maxBar = Math.max(...(dash?.runsPerDay?.map((b) => b.succeeded + b.failed) ?? [1]), 1);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  }, [searchInput]);

  return (
    <AppShell active="/dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">My automations</h1>
            <p className="text-sm text-ink-3">How your automations performed over the last 30 days.</p>
          </div>
          <Button asChild>
            <a href="/zap/create">Create automation</a>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-ink-3">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-medium font-mono text-ink">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold">Runs per day</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-xs text-ink-3">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-ink" /> Succeeded</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm bg-chart-failed" /> Failed</span>
              </div>
              <Tabs value={window} onValueChange={setWindow}>
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="h-7 px-2.5 text-xs">7d</TabsTrigger>
                  <TabsTrigger value="30d" className="h-7 px-2.5 text-xs">30d</TabsTrigger>
                  <TabsTrigger value="90d" className="h-7 px-2.5 text-xs">90d</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {dashLoading ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-ink-3">Loading…</div>
            ) : (
              <div className="flex h-[180px] items-end gap-1.5 px-1">
                {(dash?.runsPerDay ?? []).map((bar, i) => {
                  const total = bar.succeeded + bar.failed;
                  const succH = total > 0 ? (bar.succeeded / maxBar) * 100 : 0;
                  const failH = total > 0 ? (bar.failed / maxBar) * 100 : 0;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                      {failH > 0 && <div className="w-full rounded-t-xs bg-chart-failed" style={{ height: `${failH}%` }} />}
                      <div className="w-full rounded-b-xs bg-ink" style={{ height: `${succH}%` }} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Automations</CardTitle>
            <div className="flex items-center gap-2">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <Input placeholder="Search automations" className="h-8 w-40" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              </form>
              <Button variant="secondary" size="sm" asChild>
                <a href="/history">View history</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {zapsLoading ? (
              <p className="text-sm text-ink-3">Loading automations…</p>
            ) : zaps.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-ink-3">No automations yet. Create your first automation to get started.</p>
                <div className="mt-3">
                  <Button asChild><a href="/zap/create">Create automation</a></Button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs font-medium text-ink-3">
                        <th className="pb-2 pr-4">Name</th>
                        <th className="pb-2 pr-4">Steps</th>
                        <th className="pb-2 pr-4">On</th>
                        <th className="pb-2 pr-4">Last run</th>
                        <th className="pb-2 pr-4">Status</th>
                        <th className="pb-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {zaps.map((zap) => (
                        <tr key={zap.id} className="border-b border-line last:border-0">
                          <td className="py-3 pr-4 font-medium text-ink">
                            <a href={`/zap/${zap.id}`} className="hover:text-flame-600">{zap.name}</a>
                          </td>
                          <td className="py-3 pr-4 text-ink-3">{zap.steps}</td>
                          <td className="py-3 pr-4">
                            <Switch
                              checked={zap.active}
                              onCheckedChange={(checked) => toggleMutation.mutate({ id: zap.id, active: checked })}
                            />
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs text-ink-3">{zap.lastRun ?? "—"}</td>
                          <td className="py-3 pr-4">
                            <Badge variant={zap.status === "FAILED" ? "failed" : zap.status === "SUCCESS" ? "success" : "neutral"}>
                              {zap.status ?? "—"}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <a href={`/history?zap=${zap.id}`} className="text-xs text-flame-600 hover:underline">View history</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {zaps.map((zap) => (
                    <div key={zap.id} className="rounded-lg border border-line bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <a href={`/zap/${zap.id}`} className="font-medium text-ink hover:text-flame-600">{zap.name}</a>
                        <Switch
                          checked={zap.active}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: zap.id, active: checked })}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-ink-3">
                        <span>{zap.steps} steps</span>
                        <span>·</span>
                        <span>{zap.lastRun ?? "No runs"}</span>
                        <Badge variant={zap.status === "FAILED" ? "failed" : zap.status === "SUCCESS" ? "success" : "neutral"} className="ml-auto">
                          {zap.status ?? "—"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right rail - only on xl */}
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2" />
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Needs attention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(dash?.failedRuns ?? []).length === 0 && (dash?.suspendedRuns ?? []).length === 0 ? (
                  <p className="text-xs text-ink-3">Nothing needs attention.</p>
                ) : (
                  <>
                    {dash?.failedRuns?.map((r) => (
                      <div key={r.id} className="rounded-sm bg-status-failed-bg px-3 py-2 text-xs">
                        <span className="font-medium text-ink">{r.zapName}</span>
                        <span className="text-status-failed"> failed. Review</span>
                      </div>
                    ))}
                    {dash?.suspendedRuns?.map((r) => (
                      <div key={r.id} className="rounded-sm bg-status-suspended-bg px-3 py-2 text-xs">
                        <span className="font-medium text-ink">{r.zapName}</span>
                        <span className="text-status-suspended"> is suspended. Resume</span>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Getting started</CardTitle>
                <span className="font-mono text-xs text-ink-3">2 / 4</span>
              </CardHeader>
              <CardContent>
                <div className="mb-3 h-1.5 w-full rounded-full bg-line">
                  <div className="h-1.5 w-1/2 rounded-full bg-flame-500" />
                </div>
                <ul className="space-y-2 text-xs text-ink-2">
                  {["Create your first automation", "Publish an automation", "Connect an app", "Run a test"].map((item, i) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${i < 2 ? "bg-status-success text-white" : "border border-line-strong bg-surface"}`}>
                        {i < 2 && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
