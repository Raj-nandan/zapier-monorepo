"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";


type ZapDetail = {
  id: string;
  name: string | null;
  active: boolean;
  revision: number;
  webhookUrl: string;
  trigger: any;
  actions: any[];
};

async function fetchZap(id: string): Promise<ZapDetail> {
  const res = await apiFetch(`/zap/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load automation");
  return res.json();
}

export default function ZapDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const queryClient = useQueryClient();
  const { data: zap, isLoading } = useQuery({ queryKey: ["zap", id], queryFn: () => fetchZap(id) });
  const [secret, setSecret] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const toggleMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const res = await apiFetch(`/zap/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["zap", id] }),
  });

  async function handleRotate() {
    const res = await apiFetch(`/zap/${id}/secret/rotate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setSecret(data.secret);
    } else if (res.status === 401) {
      alert("Re-authentication required.");
    }
  }

  async function handleTest() {
    const res = await apiFetch(`/zap/${id}/test`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setTestResult(`Run started: ${data.zapRunId}`);
    } else {
      setTestResult("Failed to start test run.");
    }
  }

  if (isLoading || !zap) {
    return <AppShell active="/dashboard"><p className="text-sm text-ink-3">Loading…</p></AppShell>;
  }

  return (
    <AppShell active="/dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{zap.name ?? "Automation"}</h1>
            <p className="text-sm text-ink-3">Revision {zap.revision}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleTest}>Test</Button>
            <Button variant="secondary" size="sm" onClick={handleRotate}>Rotate secret</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Active</span>
              <Switch checked={zap.active} onCheckedChange={(c) => toggleMutation.mutate(c)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Webhook URL</label>
              <input readOnly value={zap.webhookUrl} className="w-full rounded-md border border-line bg-sunken px-3 py-2 font-mono text-xs" />
            </div>
            {secret && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">New secret (shown once)</label>
                <input readOnly value={secret} className="w-full rounded-md border border-line bg-sunken px-3 py-2 font-mono text-xs" />
              </div>
            )}
            {testResult && <p className="text-sm text-ink-3">{testResult}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trigger</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-sunken p-3 text-xs">{JSON.stringify(zap.trigger, null, 2)}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-sunken p-3 text-xs">{JSON.stringify(zap.actions, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
