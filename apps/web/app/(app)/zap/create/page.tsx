"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


type Trigger = { id: string; slug: string; name?: string; label?: string };
type Action = { id: string; slug: string; name?: string; label?: string };

async function fetchTriggers() {
  const res = await apiFetch("/trigger/available", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.triggers ?? data ?? [];
}

async function fetchActions() {
  const res = await apiFetch("/action/available", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.actions ?? data ?? [];
}

export default function ZapCreatePage() {
  const [name, setName] = useState("Automation name");
  const [triggerId, setTriggerId] = useState<string | null>(null);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ zapId: string; webhookUrl: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sample, setSample] = useState<unknown>(null);

  const { data: backendTriggers = [] } = useQuery({ queryKey: ["triggers"], queryFn: fetchTriggers });
  const { data: backendActions = [] } = useQuery({ queryKey: ["actions"], queryFn: fetchActions });

  const triggers: Trigger[] = backendTriggers.length ? backendTriggers : [];
  const actions: Action[] = backendActions.length ? backendActions : [];

  function toggleAction(id: string) {
    setActionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleTestTrigger() {
    if (!triggerId) return;
    setTesting(true);
    setSample(null);
    try {
      const res = await apiFetch("/zap/test-trigger", {
        method: "POST",
        body: JSON.stringify({ availableTriggerId: triggerId, triggerMetadata: {} }),
      });
      const data = await res.json();
      setSample(data.items ?? data);
    } catch {
      setSample({ error: "failed" });
    } finally {
      setTesting(false);
    }
  }

  async function handlePublish() {
    if (!triggerId || actionIds.length === 0) {
      setError("Select a trigger and at least one action.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await apiFetch("/zap", {
        method: "POST",
        body: JSON.stringify({
          name,
          availableTriggerId: triggerId,
          triggerMetadata: {},
          actions: actionIds.map((id) => ({ availableActionId: id, actionMetadata: {} })),
        }),
      });
      if (!res.ok) {
        setError("Failed to publish. Check your selections.");
        return;
      }
      const data = await res.json();
      setResult({ zapId: data.zapId, webhookUrl: data.webhookUrl, secret: data.secret });
    } catch {
      setError("Something went wrong.");
    } finally {
      setPublishing(false);
    }
  }

  if (result) {
    return (
      <AppShell active="/zap/create">
        <div className="mx-auto max-w-xl space-y-4">
          <h1 className="text-2xl font-semibold text-ink">Published</h1>
          <p className="text-sm text-ink-3">Automation {result.zapId} is live.</p>
          <div className="rounded-md border border-line bg-surface p-4">
            <div className="text-xs font-medium text-ink-3">Webhook URL</div>
            <div className="mt-1 break-all font-mono text-xs text-ink">{result.webhookUrl}</div>
            <div className="mt-3 text-xs font-medium text-ink-3">Secret (shown once)</div>
            <div className="mt-1 break-all font-mono text-xs text-ink">{result.secret}</div>
          </div>
          <Button asChild><a href={`/zap/${result.zapId}`}>Open automation</a></Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="/zap/create">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-64 text-base font-semibold" />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleTestTrigger} disabled={!triggerId || testing}>
              {testing ? "Testing…" : "Test trigger"}
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-status-failed">{error}</p>}
        {sample !== null && (
          <pre className="overflow-auto rounded-md bg-sunken p-3 text-xs">{JSON.stringify(sample, null, 2)}</pre>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Trigger</h2>
            <div className="space-y-2">
              {triggers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTriggerId(t.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${triggerId === t.id ? "border-flame-500 bg-flame-50" : "border-line"}`}
                >
                  {t.name ?? t.label ?? t.slug}
                </button>
              ))}
              {triggers.length === 0 && <p className="text-sm text-ink-3">Loading triggers…</p>}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Actions</h2>
            <div className="space-y-2">
              {actions.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAction(a.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${actionIds.includes(a.id) ? "border-flame-500 bg-flame-50" : "border-line"}`}
                >
                  {a.name ?? a.label ?? a.slug}
                </button>
              ))}
              {actions.length === 0 && <p className="text-sm text-ink-3">Loading actions…</p>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
