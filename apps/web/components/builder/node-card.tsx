"use client";

import { Plus } from "lucide-react";
import { Icon } from "./icons";

const ringOff = "0 0 0 1px #d6cfc2, 0 1px 2px rgba(28,25,23,.06)";
const ringOn = "0 0 0 2px #faf8f5, 0 0 0 4px #f2540b, 0 8px 24px -8px rgba(28,25,23,.18)";

export interface NodeCardNode {
  id: string;
  title: string;
  sub: string;
  iconPath: string;
  iconBg: string;
  iconFg: string;
  status: "ok" | "idle";
}

export function NodeCard({
  node,
  selected,
  onSelect,
  onInsert,
}: {
  node: NodeCardNode;
  selected: boolean;
  onSelect: () => void;
  onInsert: () => void;
}) {
  const isOk = node.status === "ok";
  return (
    <div className="flex w-full flex-col items-center">
      <div
        onClick={onSelect}
        style={{ boxShadow: selected ? ringOn : ringOff }}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white p-3.5 transition-all duration-150 hover:shadow-md"
      >
        <span
          style={{ background: node.iconBg, color: node.iconFg }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
        >
          <Icon d={node.iconPath} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-snug text-[#1c1917]">{node.title}</div>
          <div className="truncate text-xs leading-normal text-[#6b665f]">{node.sub}</div>
        </div>
        <span
          style={{ background: isOk ? "#ecfdf3" : "#f3f0ea", color: isOk ? "#15803d" : "#57534e" }}
          className="inline-flex h-5 items-center justify-center rounded px-1.5"
        >
          <Icon d={isOk ? "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM9 12l2 2 4-4" : "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 6v6l4 2"} size={14} />
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className="h-5 w-[1.5px] bg-[#a8a29e]" />
        <button
          type="button"
          aria-label="Insert step here"
          onClick={(e) => {
            e.stopPropagation();
            onInsert();
          }}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[#57534e] shadow-[0_0_0_1px_#d6cfc2] transition-transform hover:scale-110 hover:text-[#1c1917]"
        >
          <Plus className="h-3 w-3 stroke-[2]" />
        </button>
        <span className="h-5 w-[1.5px] bg-[#a8a29e]" />
      </div>
    </div>
  );
}
