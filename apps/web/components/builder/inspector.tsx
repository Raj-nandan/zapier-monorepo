"use client";

import { Play, Trash2, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import type { BuilderStep } from "./types";

export function Inspector({
  selectedStep,
  selectedStepIndex,
  activeTab,
  setActiveTab,
  handleMetadataChange,
  insertToken,
  handleTestTrigger,
  handleMoveStep,
  handleDeleteStep,
  testingTrigger,
  sampleData,
  selectedSampleIndex,
  setSelectedSampleIndex,
  publishResult,
  onTitleChange,
}: {
  selectedStep: BuilderStep | null;
  selectedStepIndex: number;
  activeTab: "Setup" | "Test" | "Settings";
  setActiveTab: (tab: "Setup" | "Test" | "Settings") => void;
  handleMetadataChange: (key: string, value: string) => void;
  insertToken: (token: string, targetKey: string) => void;
  handleTestTrigger: () => void;
  handleMoveStep: (direction: "up" | "down") => void;
  handleDeleteStep: (stepId: string) => void;
  testingTrigger: boolean;
  sampleData: any[] | null;
  selectedSampleIndex: number;
  setSelectedSampleIndex: (index: number) => void;
  publishResult: { zapId: string; webhookUrl: string; secret: string } | null;
  onTitleChange: (title: string) => void;
}) {
  return (
    <aside
      aria-label="Step inspector"
      className="flex h-full w-[320px] min-w-[320px] max-w-[320px] flex-col overflow-y-auto border-l border-[#e7e2d9] bg-white shadow-[inset_1px_0_0_#e7e2d9]"
    >
      <div className="flex flex-col gap-3 border-b border-[#e7e2d9] p-4 shadow-[0_1px_0_0_#e7e2d9]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#f3f0ea] text-xs font-semibold text-[#1c1917]">
            {selectedStepIndex}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#1c1917]">{selectedStep?.title}</div>
            <div className="text-xs text-[#6b665f]">{selectedStep?.kind === "trigger" ? "Trigger" : "Action"}</div>
          </div>
          {selectedStep?.kind === "action" && (
            <button
              type="button"
              title="Delete step"
              onClick={() => selectedStep && handleDeleteStep(selectedStep.id)}
              className="rounded p-1 text-[#6b665f] hover:bg-[#f3f0ea] hover:text-red-600"
            >
              <Trash2 className="h-4 w-4 stroke-[1.75]" />
            </button>
          )}
        </div>
        <div className="flex gap-0.5 rounded-lg bg-[#f3f0ea] p-[3px]">
          {(["Setup", "Test", "Settings"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md py-1 text-center text-[13px] font-medium leading-tight transition-colors ${
                  isActive ? "bg-white text-[#1c1917] shadow-[0_1px_2px_rgba(28,25,23,.06)]" : "text-[#57534e] hover:text-[#1c1917]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "Setup" && (
        <div className="flex flex-col gap-4 p-4">
          {selectedStep?.kind === "trigger" && selectedStep.slug === "webhook" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#1c1917]">Event method</label>
                <input className="fld bg-sunken font-mono" readOnly value="POST" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#1c1917]">Webhook Endpoint</label>
                <div className="flex items-center gap-1.5">
                  <input
                    className="fld font-mono text-xs"
                    readOnly
                    value={publishResult?.webhookUrl || "http://localhost:3002/hooks/catch/[published_zap_id]"}
                  />
                </div>
                <div className="text-xs text-[#6b665f]">Payload sent to this endpoint will instantly trigger this zap.</div>
              </div>
            </>
          )}

          {selectedStep?.kind === "action" && selectedStep.slug === "email" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#1c1917]">Recipient (To)</label>
                <input className="fld" type="text" value={selectedStep.metadata.to || ""} onChange={(e) => handleMetadataChange("to", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#1c1917]">Subject</label>
                <input className="fld" type="text" value={selectedStep.metadata.subject || ""} onChange={(e) => handleMetadataChange("subject", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#1c1917]">Email Body</label>
                <textarea rows={3} className="fld h-auto py-2 font-mono" value={selectedStep.metadata.body || ""} onChange={(e) => handleMetadataChange("body", e.target.value)} />
                <div className="text-xs text-[#6b665f]">Insert data from an earlier step.</div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {["{{ trigger.customer }}", "{{ trigger.total }}"].map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => insertToken(token, "body")}
                      className="rounded bg-[#f3f0ea] px-1.5 py-0.5 font-mono text-[11px] text-[#c2410c] hover:bg-[#ffe4d6]"
                    >
                      + {token}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {selectedStep?.kind === "action" &&
            (selectedStep.slug === "rows" || selectedStep.title.toLowerCase().includes("spreadsheet")) && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f1" className="text-[13px] font-medium text-[#1c1917]">Spreadsheet</label>
                  <input id="f1" className="fld" type="text" value={selectedStep.metadata.spreadsheet || "Orders 2026"} onChange={(e) => handleMetadataChange("spreadsheet", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f2" className="text-[13px] font-medium text-[#1c1917]">Worksheet</label>
                  <input id="f2" className="fld" type="text" value={selectedStep.metadata.worksheet || "Sheet1"} onChange={(e) => handleMetadataChange("worksheet", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f3" className="text-[13px] font-medium text-[#1c1917]">Customer</label>
                  <input id="f3" className="fld font-mono" type="text" value={selectedStep.metadata.customer || "{{ trigger.customer }}"} onChange={(e) => handleMetadataChange("customer", e.target.value)} />
                  <div className="text-xs text-[#6b665f]">Insert data from an earlier step.</div>
                  <div className="flex flex-wrap gap-1">
                    {["{{ trigger.customer }}", "{{ trigger.id }}"].map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insertToken(token, "customer")}
                        className="rounded bg-[#f3f0ea] px-1.5 py-0.5 font-mono text-[11px] text-[#c2410c] hover:bg-[#ffe4d6]"
                      >
                        + {token}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="f4" className="text-[13px] font-medium text-[#1c1917]">Amount</label>
                  <input id="f4" className="fld font-mono" type="text" value={selectedStep.metadata.amount || "{{ trigger.total }}"} onChange={(e) => handleMetadataChange("amount", e.target.value)} />
                  <div className="flex flex-wrap gap-1">
                    {["{{ trigger.total }}"].map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insertToken(token, "amount")}
                        className="rounded bg-[#f3f0ea] px-1.5 py-0.5 font-mono text-[11px] text-[#c2410c] hover:bg-[#ffe4d6]"
                      >
                        + {token}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

          {selectedStep?.kind === "action" &&
            selectedStep.slug !== "email" &&
            selectedStep.slug !== "rows" &&
            !selectedStep.title.toLowerCase().includes("spreadsheet") && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#1c1917]">Step Parameter</label>
                  <input className="fld font-mono" type="text" placeholder="Configuration value" value={selectedStep.metadata.param || ""} onChange={(e) => handleMetadataChange("param", e.target.value)} />
                </div>
              </div>
            )}

          <button type="button" onClick={handleTestTrigger} className="btn-s mt-2 flex w-full items-center justify-center gap-2 rounded-lg">
            <Play className="h-3.5 w-3.5 stroke-[1.75]" />
            Test step
          </button>
        </div>
      )}

      {activeTab === "Test" && (
        <div className="flex flex-col gap-4 p-4">
          <div className="text-xs text-[#6b665f]">Verify that this step receives expected inputs and produces valid outputs.</div>
          <button
            type="button"
            onClick={handleTestTrigger}
            disabled={testingTrigger}
            className="btn-s flex w-full items-center justify-center gap-2 rounded-lg py-2"
          >
            {testingTrigger ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current stroke-[1.75]" />}
            Run test
          </button>
          {sampleData && sampleData.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#1c1917]">Sample Records ({sampleData.length})</span>
                <div className="flex gap-1">
                  {sampleData.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedSampleIndex(i)}
                      className={`rounded px-1.5 py-0.5 text-xs font-mono ${selectedSampleIndex === i ? "bg-[#1c1917] text-white" : "bg-[#f3f0ea] text-[#57534e]"}`}
                    >
                      #{i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <pre className="max-h-60 overflow-auto rounded-lg bg-[#f3f0ea] p-3 font-mono text-xs text-[#1c1917]">
                {JSON.stringify(sampleData[selectedSampleIndex] ?? sampleData[0], null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === "Settings" && (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[#1c1917]">Step Label</label>
            <input className="fld" type="text" value={selectedStep?.title || ""} onChange={(e) => onTitleChange(e.target.value)} />
          </div>
          {selectedStep?.kind === "action" && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-[#1c1917]">Reorder Action</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleMoveStep("up")} className="btn-s flex-1 justify-center gap-1.5 text-xs">
                    <ChevronUp className="h-3.5 w-3.5" /> Move up
                  </button>
                  <button type="button" onClick={() => handleMoveStep("down")} className="btn-s flex-1 justify-center gap-1.5 text-xs">
                    <ChevronDown className="h-3.5 w-3.5" /> Move down
                  </button>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => selectedStep && handleDeleteStep(selectedStep.id)}
                  className="btn-s flex w-full items-center justify-center gap-2 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove this step
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
