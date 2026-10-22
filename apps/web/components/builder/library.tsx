"use client";

import { Search } from "lucide-react";
import { Icon } from "./icons";

export interface LibraryItem {
  slug: string;
  label: string;
  d: string;
  bg: string;
  fg: string;
}

export interface LibraryGroup {
  h: string;
  items: LibraryItem[];
}

export function Library({
  groups,
  searchQuery,
  onSearch,
  onSelect,
}: {
  groups: LibraryGroup[];
  searchQuery: string;
  onSearch: (value: string) => void;
  onSelect: (item: LibraryItem, groupHeader: string) => void;
}) {
  return (
    <aside className="flex h-full w-[260px] min-w-[260px] max-w-[260px] flex-col gap-4 overflow-y-auto border-r border-[#e7e2d9] bg-white p-3 shadow-[inset_-1px_0_0_#e7e2d9]">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-2.5 text-[#6b665f]">
          <Search className="h-3.5 w-3.5 stroke-[1.75]" />
        </span>
        <input
          type="search"
          aria-label="Search steps"
          placeholder="Search steps"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="fld text-[13px]"
          style={{ paddingLeft: "32px" }}
        />
      </div>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.h} className="flex flex-col gap-1">
            <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-[#6b665f]">{g.h}</div>
            {g.items.map((i) => (
              <button
                type="button"
                key={i.label}
                onClick={() => onSelect(i, g.h)}
                className="lib w-full text-left"
              >
                <span style={{ background: i.bg, color: i.fg }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
                  <Icon d={i.d} size={14} />
                </span>
                <span className="truncate">{i.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
