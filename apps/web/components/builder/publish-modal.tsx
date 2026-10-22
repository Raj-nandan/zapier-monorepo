"use client";

import Link from "next/link";
import { Check, Copy, ExternalLink } from "lucide-react";

export function PublishModal({
  name,
  publishResult,
  copiedUrl,
  copiedSecret,
  onCopyUrl,
  onCopySecret,
}: {
  name: string;
  publishResult: { zapId: string; webhookUrl: string; secret: string };
  copiedUrl: boolean;
  copiedSecret: boolean;
  onCopyUrl: () => void;
  onCopySecret: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#e7e2d9] bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ecfdf3] text-[#15803d]">
            <Check className="h-6 w-6 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#1c1917]">Automation Published</h2>
            <p className="text-xs text-[#6b665f]">
              {name} (ID: {publishResult.zapId})
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-3.5">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-[#6b665f]">Webhook URL</label>
            <div className="mt-1 flex items-center gap-1.5">
              <input readOnly value={publishResult.webhookUrl} className="fld font-mono text-xs text-[#1c1917]" />
              <button type="button" onClick={onCopyUrl} className="btn-s h-[34px] shrink-0 px-2.5" title="Copy URL">
                {copiedUrl ? <Check className="h-4 w-4 text-[#15803d]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-[#6b665f]">Webhook Secret</label>
              <span className="text-[11px] font-semibold text-[#b42318]">Shown once</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <input readOnly value={publishResult.secret} className="fld font-mono text-xs text-[#1c1917]" />
              <button type="button" onClick={onCopySecret} className="btn-s h-[34px] shrink-0 px-2.5" title="Copy Secret">
                {copiedSecret ? <Check className="h-4 w-4 text-[#15803d]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-[#6b665f]">
              Use this secret to sign payloads with HMAC-SHA256 in the <code className="font-mono">X-Hub-Signature-256</code> header.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <Link href="/dashboard" className="btn-s px-4">Back to dashboard</Link>
          <Link href={`/zap/${publishResult.zapId}`} className="btn-p flex items-center gap-1.5 px-4">
            Open automation
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
