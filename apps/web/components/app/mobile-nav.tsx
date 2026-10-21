"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Plus, History, Settings } from "lucide-react";

const tabs = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Create", href: "/zap/create", icon: Plus },
  { label: "History", href: "/history", icon: History },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-line bg-surface lg:hidden">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${active ? "text-ink" : "text-ink-3"}`}
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileHeader({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-flame-500 text-white">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
      </span>
      <span className="text-base font-semibold text-ink">{title}</span>
      <div className="ml-auto flex items-center gap-2">
        <button className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-ink-2 hover:bg-sunken">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        </button>
      </div>
    </header>
  );
}