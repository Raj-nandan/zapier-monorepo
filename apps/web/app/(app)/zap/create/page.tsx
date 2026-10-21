"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Kbd } from "@/components/ui/kbd";
import { Webhook, Clock, Link2, Mail, Sheet, MessageSquare, Filter, Timer, Globe } from "lucide-react";

const TRIGGERS = [
  { label: "Webhook", icon: Webhook },
  { label: "Schedule", icon: Clock },
  { label: "App event", icon: Link2 },
];
const ACTIONS = [
  { label: "Send email", icon: Mail },
  { label: "Add spreadsheet row", icon: Sheet },
  { label: "Post message", icon: MessageSquare },
  { label: "Filter", icon: Filter },
  { label: "Delay", icon: Timer },
  { label: "HTTP request", icon: Globe },
];

type Step = { id: string; kind: "trigger" | "action"; label: string; index: number };

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
  const [steps, setSteps] = useState<Step[]>([
    { id: "1", kind: "trigger", label: "Catch webhook", index: 0 },
  ]);
  const [selectedStep, setSelectedStep] = useState(0);
  const [search, setSearch] = useState("");
  const { data: backendTriggers = [] } = useQuery({ queryKey: ["triggers"], queryFn: fetchTriggers });
  const { data: backendActions = [] } = useQuery({ queryKey: ["actions"], queryFn: fetchActions });

  function addStep(label: string, kind: "trigger" | "action") {
    setSteps((prev) => [...prev, { id: String(prev.length + 1), kind, label, index: prev.length }]);
  }

  const triggerList = backendTriggers.length > 0 ? backendTriggers : TRIGGERS;
  const actionList = backendActions.length > 0 ? backendActions : ACTIONS;
  const filteredTriggers = triggerList.filter((t: any) => (t.label ?? t.name ?? "").toLowerCase().includes(search.toLowerCase()));
  const filteredActions = actionList.filter((a: any) => (a.label ?? a.name ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell active="/zap/create">
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        {/* Top bar */}
        <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-sunken">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="h-5 w-px bg-line" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56 border-none bg-transparent text-base font-semibold text-ink outline-none placeholder:text-ink-3"
            placeholder="Automation name"
          />
          <Badge variant="neutral">Draft</Badge>
          <span className="text-xs text-ink-3">Saved · 12:04</span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Test
            </Button>
            <Button size="sm">
              Publish <Kbd className="ml-1.5">⌘↵</Kbd>
            </Button>
          </div>
        </div>

        {/* Three columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Step library */}
          <div className="w-[260px] shrink-0 border-r border-line bg-surface p-3">
            <Input placeholder="Search steps" className="mb-3 h-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="space-y-4">
              {filteredTriggers.length > 0 && (
                <div>
                  <div className="mb-1.5 px-2 text-xs font-medium uppercase tracking-wider text-ink-3">Triggers</div>
                  <div className="space-y-1">
                    {filteredTriggers.map((t: any) => (
                      <button
                        key={t.label ?? t.name}
                        onClick={() => addStep(t.label, "trigger")}
                        className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-sm font-medium text-ink hover:bg-sunken"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-xs bg-flame-50 text-flame-600"><t.icon className="h-3.5 w-3.5" /></span>
                        {t.label ?? t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filteredActions.length > 0 && (
                <div>
                  <div className="mb-1.5 px-2 text-xs font-medium uppercase tracking-wider text-ink-3">Actions</div>
                  <div className="space-y-1">
                    {filteredActions.map((a: any) => (
                      <button
                        key={a.label ?? a.name}
                        onClick={() => addStep(a.label, "action")}
                        className="flex h-9 w-full items-center gap-2.5 rounded-sm px-2 text-sm font-medium text-ink hover:bg-sunken"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-xs bg-sunken text-ink"><a.icon className="h-3.5 w-3.5" /></span>
                        {a.label ?? a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-paper p-10">
            <div className="mx-auto max-w-[300px] space-y-0">
              {steps.map((step, i) => (
                <div key={step.id}>
                  {i > 0 && (
                    <div className="flex flex-col items-center py-1">
                      <div className="h-5 w-px bg-ink-4" />
                      <button className="flex h-5 w-5 items-center justify-center rounded-full border border-line-strong bg-surface text-xs text-ink-3 hover:bg-sunken">+</button>
                      <div className="h-5 w-px bg-ink-4" />
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedStep(i)}
                    className={`w-full rounded-xl border bg-surface p-3.5 text-left shadow-xs transition-all ${
                      selectedStep === i ? "border-flame-500 ring-2 ring-flame-500/20 shadow-sm" : "border-line-strong"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold ${
                        step.kind === "trigger" ? "bg-flame-50 text-flame-600" : "bg-sunken text-ink"
                      }`}>
                        {step.index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-ink">{step.label}</div>
                        <div className="text-xs text-ink-3">{step.kind === "trigger" ? "Trigger" : "Action"}</div>
                      </div>
                      <Badge variant={step.kind === "trigger" ? "neutral" : "neutral"} className="text-[10px]">
                        {step.kind === "trigger" ? "Webhook" : "Ready"}
                      </Badge>
                    </div>
                  </button>
                </div>
              ))}
              <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-transparent py-3 text-sm font-medium text-ink-2 hover:border-flame-300 hover:text-ink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                Add step
              </button>
            </div>
          </div>

          {/* Inspector */}
          <div className="w-[320px] shrink-0 border-l border-line bg-surface">
            <div className="border-b border-line p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-sunken text-xs font-semibold text-ink">{selectedStep + 1}</span>
                <div>
                  <div className="text-sm font-semibold text-ink">{steps[selectedStep]?.label ?? "—"}</div>
                  <div className="text-xs text-ink-3">{steps[selectedStep]?.kind === "trigger" ? "Trigger" : "Action"}</div>
                </div>
              </div>
            </div>
            <Tabs defaultValue="setup" className="p-4">
              <TabsList className="w-full">
                <TabsTrigger value="setup" className="flex-1">Setup</TabsTrigger>
                <TabsTrigger value="test" className="flex-1">Test</TabsTrigger>
                <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
              </TabsList>
              <TabsContent value="setup" className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Spreadsheet</label>
                  <Input placeholder="Select spreadsheet" className="h-9" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Worksheet</label>
                  <Input placeholder="Select worksheet" className="h-9" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Customer</label>
                  <Input placeholder="Insert data from an earlier step." className="h-9" />
                  <p className="mt-1 text-xs text-ink-3">Insert data from an earlier step.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Amount</label>
                  <Input placeholder="{{1.amount}}" className="h-9 font-mono" />
                </div>
                <Button variant="secondary" size="sm" className="w-full">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Test step
                </Button>
              </TabsContent>
              <TabsContent value="test" className="mt-4">
                <p className="text-sm text-ink-3">Run a test to see sample output.</p>
              </TabsContent>
              <TabsContent value="settings" className="mt-4 space-y-3">
                <p className="text-sm text-ink-3">Workflow summary, active toggle, webhook URL, and secret rotation.</p>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

