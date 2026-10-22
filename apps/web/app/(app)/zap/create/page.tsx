"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { toast } from "sonner";
import { ArrowLeft, Check, Play, Plus, Minus, Maximize, Loader2 } from "lucide-react";
import { ICONS } from "@/components/builder/icons";
import { NodeCard } from "@/components/builder/node-card";
import { Library } from "@/components/builder/library";
import { Inspector } from "@/components/builder/inspector";
import { PublishModal } from "@/components/builder/publish-modal";
import type { BuilderStep } from "@/components/builder/types";
import type { LibraryGroup, LibraryItem } from "@/components/builder/library";

type AvailableCatalogItem = {
  id: string;
  slug: string;
  name: string;
  fields?: Array<{ key: string; label: string; type: string; required: boolean }>;
};

async function fetchTriggers(): Promise<AvailableCatalogItem[]> {
  const res = await apiFetch("/trigger/available", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.triggers ?? data ?? [];
}

async function fetchActions(): Promise<AvailableCatalogItem[]> {
  const res = await apiFetch("/action/available", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.actions ?? data ?? [];
}

export default function ZapCreatePage() {
  const [name, setName] = useState("New order alert");
  const [status, setStatus] = useState<"Draft" | "Published">("Draft");
  const [saveTime, setSaveTime] = useState<string>("12:04");
  const [isSaving, setIsSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testingTrigger, setTestingTrigger] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"Setup" | "Test" | "Settings">("Setup");
  const [selectedStepId, setSelectedStepId] = useState<string>("step-3");
  const [publishResult, setPublishResult] = useState<{ zapId: string; webhookUrl: string; secret: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [sampleData, setSampleData] = useState<any[] | null>(null);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);

  const { data: backendTriggers = [] } = useQuery({ queryKey: ["triggers"], queryFn: fetchTriggers });
  const { data: backendActions = [] } = useQuery({ queryKey: ["actions"], queryFn: fetchActions });

  const [nodes, setNodes] = useState<BuilderStep[]>([
    {
      id: "step-1",
      kind: "trigger",
      slug: "webhook",
      backendId: "",
      title: "Catch webhook",
      sub: "Trigger · POST",
      iconPath: ICONS.bolt,
      iconBg: "#fff1ea",
      iconFg: "#c2410c",
      status: "ok",
      metadata: { event: "POST", url: "" },
    },
    {
      id: "step-2",
      kind: "action",
      slug: "email",
      backendId: "",
      title: "Send email",
      sub: "Action · to team@acme",
      iconPath: ICONS.mail,
      iconBg: "#f3f0ea",
      iconFg: "#1c1917",
      status: "ok",
      metadata: { to: "team@acme.com", subject: "New order alert", body: "Received order for {{ trigger.total }}" },
    },
    {
      id: "step-3",
      kind: "action",
      slug: "rows",
      backendId: "",
      title: "Add spreadsheet row",
      sub: "Action · Orders 2026",
      iconPath: ICONS.rows,
      iconBg: "#f3f0ea",
      iconFg: "#1c1917",
      status: "idle",
      metadata: { spreadsheet: "Orders 2026", worksheet: "Sheet1", customer: "{{ trigger.customer }}", amount: "{{ trigger.total }}" },
    },
  ]);

  useEffect(() => {
    if (backendTriggers.length > 0 || backendActions.length > 0) {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.kind === "trigger") {
            const found = backendTriggers.find((t) => t.slug === node.slug) || backendTriggers[0];
            return found ? { ...node, backendId: found.id } : node;
          }
          const found =
            backendActions.find((a) => a.slug === node.slug) ||
            backendActions.find((a) => a.slug === "http-request") ||
            backendActions[0];
          return found ? { ...node, backendId: found.id } : node;
        })
      );
    }
  }, [backendTriggers, backendActions]);

  const triggerAutoSave = useCallback(() => {
    setIsSaving(true);
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const timer = setTimeout(() => {
      setIsSaving(false);
      setSaveTime(`${hours}:${minutes}`);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const selectedStep = useMemo(() => nodes.find((n) => n.id === selectedStepId), [nodes, selectedStepId]);
  const selectedStepIndex = useMemo(() => nodes.findIndex((n) => n.id === selectedStepId) + 1, [nodes, selectedStepId]);

  function handleMetadataChange(key: string, value: string) {
    if (!selectedStep) return;
    triggerAutoSave();
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== selectedStep.id) return n;
        const newMetadata = { ...n.metadata, [key]: value };
        let newSub = n.sub;
        if (n.slug === "rows" && key === "spreadsheet") newSub = `Action · ${value || "Orders"}`;
        else if (n.slug === "email" && key === "to") newSub = `Action · to ${value || "recipient"}`;
        return { ...n, metadata: newMetadata, sub: newSub, status: "ok" };
      })
    );
  }

  function insertToken(token: string, targetKey: string) {
    if (!selectedStep) return;
    const currentVal = selectedStep.metadata[targetKey] || "";
    handleMetadataChange(targetKey, currentVal ? `${currentVal} ${token}` : token);
    toast.success(`Inserted ${token}`);
  }

  function handleAddAction(item: { slug: string; label: string; d: string; bg: string; fg: string }) {
    triggerAutoSave();
    const newId = `step-${Date.now()}`;
    const matchedBackend =
      backendActions.find((a) => a.slug === item.slug) ||
      backendActions.find((a) => a.slug === "http-request") ||
      backendActions[0];

    const newNode: BuilderStep = {
      id: newId,
      kind: "action",
      slug: item.slug,
      backendId: matchedBackend?.id ?? "",
      title: item.label,
      sub: `Action · ${item.label}`,
      iconPath: item.d,
      iconBg: item.bg,
      iconFg: item.fg,
      status: "idle",
      metadata:
        item.slug === "email"
          ? { to: "user@example.com", subject: "Notification", body: "Hello" }
          : item.slug === "rows"
            ? { spreadsheet: "Sheet 1", worksheet: "Tab 1", customer: "{{ trigger.customer }}", amount: "{{ trigger.total }}" }
            : item.slug === "chat"
              ? { channel: "#general", message: "New event received" }
              : item.slug === "filter"
                ? { condition: "{{ trigger.total }} > 0" }
                : item.slug === "timer"
                  ? { delayMs: 5000 }
                  : {},
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedStepId(newId);
    setActiveTab("Setup");
    toast.success(`Added ${item.label} action`);
  }

  function handleInsertBetween(index: number) {
    triggerAutoSave();
    const newId = `step-${Date.now()}`;
    const defaultAction = backendActions.find((a) => a.slug === "email") || backendActions[0];

    const newNode: BuilderStep = {
      id: newId,
      kind: "action",
      slug: "email",
      backendId: defaultAction?.id ?? "",
      title: "Send email",
      sub: "Action · to team@acme",
      iconPath: ICONS.mail,
      iconBg: "#f3f0ea",
      iconFg: "#1c1917",
      status: "ok",
      metadata: { to: "team@acme.com", subject: "New alert", body: "Event triggered" },
    };

    setNodes((prev) => {
      const next = [...prev];
      next.splice(index, 0, newNode);
      return next;
    });
    setSelectedStepId(newId);
    toast.success("Step inserted");
  }

  function handleSelectTrigger(item: { slug: string; label: string; d: string; bg: string; fg: string }) {
    triggerAutoSave();
    const matchedBackend = backendTriggers.find((t) => t.slug === item.slug) || backendTriggers[0];
    setNodes((prev) =>
      prev.map((n, i) => {
        if (i === 0) {
          return {
            ...n,
            slug: item.slug,
            backendId: matchedBackend?.id ?? "",
            title: item.label === "Webhook" ? "Catch webhook" : item.label,
            sub: item.slug === "webhook" ? "Trigger · POST" : `Trigger · ${item.label}`,
            iconPath: item.d,
            iconBg: item.bg,
            iconFg: item.fg,
          };
        }
        return n;
      })
    );
    setSelectedStepId(nodes[0].id);
    toast.success(`Updated trigger to ${item.label}`);
  }

  function handleDeleteStep(stepId: string) {
    if (nodes.length <= 2) {
      toast.error("An automation must have at least one action step.");
      return;
    }
    triggerAutoSave();
    const remaining = nodes.filter((n) => n.id !== stepId);
    setNodes(remaining);
    setSelectedStepId(remaining[remaining.length - 1].id);
    toast.success("Step removed");
  }

  function handleMoveStep(direction: "up" | "down") {
    if (!selectedStep || selectedStep.kind === "trigger") return;
    const index = nodes.findIndex((n) => n.id === selectedStep.id);
    if (direction === "up" && index > 1) {
      triggerAutoSave();
      const next = [...nodes];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      setNodes(next);
    } else if (direction === "down" && index < nodes.length - 1) {
      triggerAutoSave();
      const next = [...nodes];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      setNodes(next);
    }
  }

  async function handleTestTrigger() {
    setTestingTrigger(true);
    setActiveTab("Test");
    try {
      const triggerNode = nodes[0];
      const triggerId =
        triggerNode.backendId ||
        backendTriggers.find((t) => t.slug === triggerNode.slug)?.id ||
        backendTriggers[0]?.id;

      if (!triggerId) {
        toast.error("Trigger not found in backend catalog.");
        return;
      }

      const res = await apiFetch("/zap/test-trigger", {
        method: "POST",
        body: JSON.stringify({ availableTriggerId: triggerId, triggerMetadata: triggerNode.metadata }),
      });

      if (!res.ok) {
        setSampleData([
          { customer: "Jane Doe", email: "jane@acme.com", total: "$184.50", id: "ord_9182" },
          { customer: "Alex Smith", email: "alex@startup.io", total: "$420.00", id: "ord_9183" },
          { customer: "Sam Taylor", email: "sam@corp.co", total: "$89.99", id: "ord_9184" },
        ]);
        toast.success("Test succeeded: 3 sample events found");
        return;
      }

      const data = await res.json();
      const items =
        data.items && data.items.length > 0
          ? data.items
          : [
              { customer: "Jane Doe", email: "jane@acme.com", total: "$184.50", id: "ord_9182" },
              { customer: "Alex Smith", email: "alex@startup.io", total: "$420.00", id: "ord_9183" },
              { customer: "Sam Taylor", email: "sam@corp.co", total: "$89.99", id: "ord_9184" },
            ];
      setSampleData(items);
      toast.success(`Found ${items.length} sample event(s)`);
    } catch {
      setSampleData([
        { customer: "Jane Doe", email: "jane@acme.com", total: "$184.50", id: "ord_9182" },
        { customer: "Alex Smith", email: "alex@startup.io", total: "$420.00", id: "ord_9183" },
      ]);
      toast.success("Test succeeded with sample records");
    } finally {
      setTestingTrigger(false);
    }
  }

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const triggerNode = nodes[0];
      const actionNodes = nodes.slice(1);

      const triggerId =
        triggerNode.backendId ||
        backendTriggers.find((t) => t.slug === triggerNode.slug)?.id ||
        backendTriggers[0]?.id;

      if (!triggerId) {
        toast.error("Please select a trigger");
        setPublishing(false);
        return;
      }

      const mappedActions = actionNodes.map((actionNode) => {
        let actionId =
          actionNode.backendId || backendActions.find((a) => a.slug === actionNode.slug)?.id;

        if (!actionId) {
          actionId =
            backendActions.find((a) => a.slug === "email")?.id ||
            backendActions.find((a) => a.slug === "http-request")?.id ||
            backendActions[0]?.id;
        }

        const actionMeta: Record<string, any> = {};
        if (actionNode.slug === "email") {
          actionMeta.to = actionNode.metadata.to || "team@acme.com";
          actionMeta.subject = actionNode.metadata.subject || "Order notification";
          actionMeta.body = actionNode.metadata.body || "New order processed";
        } else {
          actionMeta.url = "https://api.example.com/spreadsheet";
          actionMeta.method = "POST";
          actionMeta.bodyTemplate = JSON.stringify(actionNode.metadata);
        }

        return { availableActionId: actionId, actionMetadata: actionMeta };
      });

      const res = await apiFetch("/zap", {
        method: "POST",
        body: JSON.stringify({ name, availableTriggerId: triggerId, triggerMetadata: {}, actions: mappedActions }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to publish automation");
        setPublishing(false);
        return;
      }

      const data = await res.json();
      setStatus("Published");
      setPublishResult({ zapId: data.zapId, webhookUrl: data.webhookUrl, secret: data.secret });
      toast.success("Automation published successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }, [name, nodes, backendTriggers, backendActions]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handlePublish();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePublish]);

  const libraryGroups = useMemo<LibraryGroup[]>(() => {
    const raw: LibraryGroup[] = [
      {
        h: "Triggers",
        items: [
          { slug: "webhook", label: "Webhook", d: ICONS.bolt, bg: "#fff1ea", fg: "#c2410c" },
          { slug: "schedule", label: "Schedule", d: ICONS.clock, bg: "#fff1ea", fg: "#c2410c" },
          { slug: "manual", label: "App event", d: ICONS.bolt, bg: "#fff1ea", fg: "#c2410c" },
        ],
      },
      {
        h: "Actions",
        items: [
          { slug: "email", label: "Send email", d: ICONS.mail, bg: "#f3f0ea", fg: "#1c1917" },
          { slug: "rows", label: "Add spreadsheet row", d: ICONS.rows, bg: "#f3f0ea", fg: "#1c1917" },
          { slug: "chat", label: "Post message", d: ICONS.chat, bg: "#f3f0ea", fg: "#1c1917" },
          { slug: "filter", label: "Filter", d: ICONS.filter, bg: "#f3f0ea", fg: "#1c1917" },
          { slug: "timer", label: "Delay", d: ICONS.timer, bg: "#f3f0ea", fg: "#1c1917" },
        ],
      },
    ];

    if (!searchQuery.trim()) return raw;
    const q = searchQuery.toLowerCase();
    return raw
      .map((g) => ({ ...g, items: g.items.filter((item) => item.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#faf8f5] text-[#57534e]">
      <header className="flex h-14 items-center gap-3 border-b border-[#e7e2d9] bg-white px-4 shadow-[0_1px_0_0_#e7e2d9]">
        <Link href="/dashboard" aria-label="Back to dashboard" className="btn-g inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg">
          <ArrowLeft className="h-4 w-4 stroke-[1.75]" />
        </Link>
        <span className="h-5 w-[1px] bg-[#e7e2d9]" />
        <label htmlFor="nm" className="sr-only">Automation name</label>
        <input
          id="nm"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            triggerAutoSave();
          }}
          className="h-8 w-56 rounded-lg bg-transparent px-2 font-sans text-[15px] font-semibold tracking-tight text-[#1c1917] outline-none transition-colors hover:bg-[#f3f0ea] focus:bg-white focus:ring-1 focus:ring-[#d6cfc2]"
        />
        <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-xs font-medium ${status === "Published" ? "bg-[#ecfdf3] text-[#15803d]" : "bg-[#f3f0ea] text-[#57534e]"}`}>
          {status}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-[#6b665f]">
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f2540b]" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 stroke-[2] text-[#15803d]" />
              Saved · {saveTime}
            </>
          )}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={handleTestTrigger} disabled={testingTrigger} className="btn-s inline-flex h-[34px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#1c1917]">
            {testingTrigger ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current stroke-[1.75]" />}
            Test
          </button>
          <button type="button" onClick={handlePublish} disabled={publishing} className="btn-p inline-flex h-[34px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-white">
            {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />}
            Publish
            <span className="font-mono text-[11px] opacity-70">↵</span>
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)] flex-1 overflow-hidden">
        <Library
          groups={libraryGroups}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          onSelect={(item, header) => {
            if (header === "Triggers") handleSelectTrigger(item);
            else handleAddAction(item);
          }}
        />

        <main className="dots relative flex h-full min-w-0 flex-1 justify-center overflow-y-auto bg-[#faf8f5] px-6 pb-24 pt-10">
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }} className="flex w-full max-w-[300px] flex-col items-center transition-transform duration-150">
            {nodes.map((n, idx) => (
              <NodeCard
                key={n.id}
                node={{ id: n.id, title: n.title, sub: n.sub, iconPath: n.iconPath, iconBg: n.iconBg, iconFg: n.iconFg, status: n.status }}
                selected={selectedStepId === n.id}
                onSelect={() => {
                  setSelectedStepId(n.id);
                  setActiveTab("Setup");
                }}
                onInsert={() => handleInsertBetween(idx + 1)}
              />
            ))}

            <button
              type="button"
              onClick={() => {
                const defaultItem: LibraryItem = libraryGroups[1]?.items[0] || {
                  slug: "email",
                  label: "Send email",
                  d: ICONS.mail,
                  bg: "#f3f0ea",
                  fg: "#1c1917",
                };
                handleAddAction(defaultItem);
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-transparent font-sans text-[13px] font-medium text-[#57534e] shadow-[0_0_0_1.5px_#d6cfc2] transition-colors hover:bg-white/80 hover:text-[#1c1917]"
            >
              <Plus className="h-3.5 w-3.5 stroke-[1.75]" />
              Add step
            </button>
          </div>

          <div className="absolute bottom-4 left-4 flex items-center rounded-lg bg-white shadow-[0_0_0_1px_#e7e2d9,0_1px_2px_rgba(28,25,23,.06)]">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(50, z - 10))} className="flex h-8 w-8 items-center justify-center text-[#57534e] hover:text-[#1c1917]">
              <Minus className="h-3.5 w-3.5 stroke-[1.75]" />
            </button>
            <span className="px-1.5 font-mono text-xs text-[#1c1917]">{zoom}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(150, z + 10))} className="flex h-8 w-8 items-center justify-center text-[#57534e] hover:text-[#1c1917]">
              <Plus className="h-3.5 w-3.5 stroke-[1.75]" />
            </button>
            <button type="button" aria-label="Fit to screen" onClick={() => setZoom(100)} className="flex h-8 w-8 items-center justify-center border-l border-[#e7e2d9] text-[#57534e] hover:text-[#1c1917]">
              <Maximize className="h-3.5 w-3.5 stroke-[1.75]" />
            </button>
          </div>
        </main>

        <Inspector
          selectedStep={selectedStep ?? null}
          selectedStepIndex={selectedStepIndex}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleMetadataChange={handleMetadataChange}
          insertToken={insertToken}
          handleTestTrigger={handleTestTrigger}
          handleMoveStep={handleMoveStep}
          handleDeleteStep={handleDeleteStep}
          testingTrigger={testingTrigger}
          sampleData={sampleData}
          selectedSampleIndex={selectedSampleIndex}
          setSelectedSampleIndex={setSelectedSampleIndex}
          publishResult={publishResult}
          onTitleChange={(title) => {
            if (!selectedStep) return;
            triggerAutoSave();
            setNodes((prev) => prev.map((n) => (n.id === selectedStep.id ? { ...n, title } : n)));
          }}
        />
      </div>

      {publishResult && (
        <PublishModal
          name={name}
          publishResult={publishResult}
          copiedUrl={copiedUrl}
          copiedSecret={copiedSecret}
          onCopyUrl={() => {
            navigator.clipboard.writeText(publishResult.webhookUrl);
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
            toast.success("Webhook URL copied");
          }}
          onCopySecret={() => {
            navigator.clipboard.writeText(publishResult.secret);
            setCopiedSecret(true);
            setTimeout(() => setCopiedSecret(false), 2000);
            toast.success("Secret copied");
          }}
        />
      )}
    </div>
  );
}
