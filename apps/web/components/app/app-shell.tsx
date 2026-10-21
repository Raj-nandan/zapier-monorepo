"use client";

import Link from "next/link";
import { ZapflowLogo } from "./zapflow-logo";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";
import { MobileTabBar, MobileHeader } from "./mobile-nav";
import { CommandPalette } from "./command-palette";

const nav = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Create automation", href: "/zap/create" },
  { label: "History", href: "/history" },
  { label: "Analytics", href: "/analytics" },
  { label: "Connections", href: "/settings#connections" },
  { label: "Settings", href: "/settings" },
];

export function AppShell({ children, active }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="hidden w-sidebar shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
        <div className="flex h-topbar items-center gap-2 px-4 border-b border-line">
          <ZapflowLogo />
          <span className="font-semibold text-ink">Zapflow</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-8 items-center rounded-sm px-3 text-sm font-medium ${
                active === item.href ? "bg-flame-50 text-ink" : "text-ink-2 hover:bg-sunken"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-3 text-xs text-ink-3">Account</div>
      </aside>
      <div className="flex flex-1 flex-col">
        <MobileHeader title="Zapflow" />
        <header className="hidden h-topbar items-center gap-3 border-b border-line bg-surface/90 px-6 lg:flex">
          <span className="text-sm font-medium text-ink-3">Zapflow</span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/settings" className="text-sm text-ink-2 hover:text-ink">Settings</Link>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-6 pb-20 lg:pb-6">{children}</main>
      </div>
      <MobileTabBar />
      <CommandPalette />
    </div>
  );
}