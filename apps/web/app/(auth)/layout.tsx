import { ThemeToggle } from "@/components/app/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8 bg-paper">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-md">{children}</div>
      </div>
      <div className="hidden lg:flex flex-col justify-center gap-6 bg-sunken p-12">
        <p className="text-3xl font-semibold text-ink leading-tight">Every run, step by step.</p>
        <p className="text-base text-ink-2">See what ran, what failed, and what to do next.</p>
        <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Lead to CRM — Run #1281</span>
            <span className="rounded-xs bg-status-failed-bg px-2 py-0.5 text-xs font-medium text-status-failed">Failed</span>
          </div>
          <p className="mt-2 text-sm text-ink-3">We couldn&apos;t reach your CRM. Retry from step 2.</p>
        </div>
      </div>
    </div>
  );
}

