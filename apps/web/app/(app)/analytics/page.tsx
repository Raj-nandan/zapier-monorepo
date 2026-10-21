"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

async function fetchAnalytics(window: string) {
  const res = await apiFetch(`/analytics?window=${window}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

export default function AnalyticsPage() {
  const [window, setWindow] = useState("30d");
  const { data, isLoading } = useQuery({ queryKey: ["analytics", window], queryFn: () => fetchAnalytics(window) });

  return (
    <AppShell active="/analytics">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Analytics</h1>
          <p className="text-sm text-ink-3">How your automations performed.</p>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold">Runs per day</CardTitle>
            <Tabs value={window} onValueChange={setWindow}>
              <TabsList className="h-8">
                <TabsTrigger value="7d" className="h-7 px-2.5 text-xs">7d</TabsTrigger>
                <TabsTrigger value="30d" className="h-7 px-2.5 text-xs">30d</TabsTrigger>
                <TabsTrigger value="90d" className="h-7 px-2.5 text-xs">90d</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-ink-3">Loading…</div>
            ) : (
              <div className="flex h-[180px] items-end gap-1.5 px-1">
                {(data?.runsPerDay ?? []).map((bar: any, i: number) => {
                  const max = Math.max(...(data?.runsPerDay?.map((b: any) => b.succeeded + b.failed) ?? [1]), 1);
                  const succH = ((bar.succeeded / max) * 100);
                  const failH = ((bar.failed / max) * 100);
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
      </div>
    </AppShell>
  );
}
