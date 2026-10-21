"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, LayoutDashboard, Plus, History, Settings, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const commands = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Navigate" },
  { label: "Create automation", href: "/zap/create", icon: Plus, group: "Navigate" },
  { label: "History", href: "/history", icon: History, group: "Navigate" },
  { label: "Settings", href: "/settings", icon: Settings, group: "Navigate" },
  { label: "Analytics", href: "/analytics", icon: Zap, group: "Navigate" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runCommand = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="rounded-lg border-0">
          <div className="flex items-center border-b border-line px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-ink-3" />
            <Command.Input
              placeholder="Search automations, runs, or navigate…"
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-ink-3">No results found.</Command.Empty>
            <Command.Group heading="Navigate" className="text-xs font-medium text-ink-3">
              {commands.map((cmd) => (
                <Command.Item
                  key={cmd.href}
                  value={cmd.label}
                  onSelect={() => runCommand(cmd.href)}
                  className="flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink outline-none data-[selected=true]:bg-sunken"
                >
                  <cmd.icon className="h-4 w-4 text-ink-3" />
                  {cmd.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
