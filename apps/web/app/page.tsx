import Link from "next/link";
import { ThemeToggle } from "@/components/app/theme-toggle";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 h-16 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-flame-500 text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </span>
            <span className="font-semibold text-ink">Zapflow</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#how" className="rounded-sm px-2.5 py-2 text-sm font-medium text-ink-2 hover:bg-sunken">How it works</a>
            <a href="#faq" className="rounded-sm px-2.5 py-2 text-sm font-medium text-ink-2 hover:bg-sunken">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="rounded-sm px-3 py-2 text-sm font-medium text-ink-2 hover:bg-sunken">Log in</Link>
            <Link href="/signup" className="rounded-sm bg-flame-500 px-4 py-2 text-sm font-medium text-white hover:bg-flame-600">Create automation</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#E7E2D9_1px,transparent_0)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black_30%,transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex h-7 items-center gap-2 rounded-xs border border-line bg-surface px-2.5 text-sm font-medium text-ink">
              <span className="rounded-xs bg-flame-100 px-1.5 py-0.5 text-[11px] font-semibold text-flame-700">New</span>
              Run history now keeps every step for 90 days.
            </div>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Automate the busywork<span className="text-flame-600">.</span>
              <br />
              Keep every run in sight<span className="text-flame-600">.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-ink-2">
              Connect your apps, publish a workflow in minutes, and see each step succeed or fail in plain language.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-sm bg-flame-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-flame-600">
                Create automation
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </Link>
              <a href="#runs" className="inline-flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-sunken">
                See a live run
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
              <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>No code required</span>
              <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>Every run logged step by step</span>
              <span className="flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>90-day run history</span>
            </div>
          </div>

          {/* Live workflow card */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-flame-50 text-flame-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">New order alert</div>
                  <div className="text-xs text-ink-3">Run #1284 — just now</div>
                </div>
                <span className="ml-auto rounded-xs bg-status-running-bg px-2 py-0.5 text-xs font-medium text-status-running">Running</span>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { n: 1, title: "Catch webhook", sub: "trigger" },
                  { n: 2, title: "Filter", sub: "action" },
                  { n: 3, title: "Send email", sub: "action" },
                ].map((step) => (
                  <div key={step.n} className="flex items-center gap-3 rounded-sm bg-sunken px-3 py-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xs border border-line bg-surface text-xs font-semibold text-ink">{step.n}</span>
                    <div>
                      <div className="text-sm font-medium text-ink">{step.title}</div>
                      <div className="font-mono text-[11px] text-ink-3">{step.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-sm bg-sunken px-3 py-2">
                <span className="truncate font-mono text-xs text-ink-3">https://hooks.zapflow.app/catch/…</span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-xs border border-line bg-surface px-2 py-1 text-xs font-medium text-status-success">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  Copied
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration marquee */}
      <section className="border-y border-line bg-surface py-8">
        <p className="mb-4 text-center text-sm font-medium text-ink-3">Works with the tools you already use</p>
        <div className="flex flex-wrap justify-center gap-3 px-6">
          {["Email", "Sheets", "Chat", "Forms", "Calendar", "Storage", "Tickets", "Database"].map((name) => (
            <span key={name} className="rounded-sm border border-line bg-paper px-4 py-2 text-sm font-medium text-ink-2">{name}</span>
          ))}
        </div>
      </section>

      {/* Bento */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12">
          <h2 className="text-3xl font-semibold text-ink">Everything a run needs, in one place</h2>
          <p className="mt-2 text-base text-ink-2">Build, test, publish, and observe without leaving the dashboard.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Build visually - 7 cols */}
          <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-7">
            <h3 className="text-lg font-semibold text-ink">Build visually</h3>
            <p className="mt-1 text-sm text-ink-2">Stack a trigger and steps on a canvas. Order follows the list, not where you drag.</p>
            <div className="mt-6 space-y-2">
              {[
                { n: 1, title: "Catch webhook" },
                { n: 2, title: "Filter" },
                { n: 3, title: "Send email" },
              ].map((s) => (
                <div key={s.n} className="flex items-center gap-3 rounded-sm bg-sunken px-3 py-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xs border border-line bg-surface text-xs font-semibold text-ink">{s.n}</span>
                  <span className="text-sm font-medium text-ink">{s.title}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Every step logged - 5 cols */}
          <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-5">
            <h3 className="text-lg font-semibold text-ink">Every step, logged</h3>
            <p className="mt-1 text-sm text-ink-2">Inputs, outputs and timings, searchable for 90 days.</p>
            <div className="mt-6 space-y-1.5 font-mono text-xs text-ink-2">
              <div className="flex justify-between"><span>12:04:01 trigger</span><span>200 12ms</span></div>
              <div className="flex justify-between"><span>12:04:01 filter</span><span>pass 3ms</span></div>
              <div className="flex justify-between"><span>12:04:02 email</span><span>sent 214ms</span></div>
              <div className="flex justify-between text-status-running"><span>12:04:02 sheet</span><span>running</span></div>
            </div>
          </div>
          {/* Switch on/off - 4 cols */}
          <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-4">
            <h3 className="text-lg font-semibold text-ink">Switch on, switch off</h3>
            <p className="mt-1 text-sm text-ink-2">Toggle instantly. If it fails, it rolls back and tells you why.</p>
            <div className="mt-6 rounded-sm bg-sunken px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Weekly report digest</span>
                <span className="rounded-xs bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success">Active — 97% success</span>
              </div>
            </div>
          </div>
          {/* Plain-language errors - 4 cols */}
          <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-4">
            <h3 className="text-lg font-semibold text-ink">Plain-language errors</h3>
            <p className="mt-1 text-sm text-ink-2">No codes, no traces. Just what happened and what to do.</p>
            <div className="mt-6 rounded-sm bg-status-failed-bg px-4 py-3">
              <p className="text-sm text-status-failed">We couldn&apos;t reach your CRM.</p>
              <button className="mt-2 text-sm font-medium text-flame-600">Retry</button>
            </div>
          </div>
          {/* Test before you publish - 4 cols */}
          <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-4">
            <h3 className="text-lg font-semibold text-ink">Test before you publish</h3>
            <p className="mt-1 text-sm text-ink-2">Fire a sample and watch every step answer back.</p>
            <div className="mt-6 flex gap-2">
              <button className="rounded-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink">Test</button>
              <button className="rounded-sm bg-flame-500 px-4 py-2 text-sm font-medium text-white">Publish ⌘↵</button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12">
          <h2 className="text-3xl font-semibold text-ink">How it works</h2>
          <p className="mt-2 text-base text-ink-2">Live in three steps</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { n: "01", title: "Pick a trigger", desc: "Start from a webhook, a schedule, or an app event." },
            { n: "02", title: "Add your actions", desc: "Send email, post to chat, call an HTTP endpoint, delay or filter." },
            { n: "03", title: "Publish and watch", desc: "Turn it on. Every run shows up in History with its steps." },
          ].map((step) => (
            <div key={step.n} className="rounded-xl border border-line bg-surface p-6">
              <div className="font-mono text-sm text-ink-3">{step.n}</div>
              <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm text-ink-2">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12">
          <h2 className="text-3xl font-semibold text-ink">FAQ</h2>
          <p className="mt-2 text-base text-ink-2">Questions, answered</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { q: "What counts as a run?", a: "One trigger firing and all of its steps. Each step is logged separately." },
            { q: "Can I retry a failed run?", a: "Yes. Open the run, find the failed step, and choose Retry." },
            { q: "How long is history kept?", a: "Runs and step details are kept for 90 days." },
            { q: "Is my webhook secret safe?", a: "It is shown once when you create or rotate it. Copy it then; we cannot show it again." },
          ].map((item) => (
            <div key={item.q} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="text-base font-semibold text-ink">{item.q}</h3>
              <p className="mt-2 text-sm text-ink-2">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA band */}
      <section className="bg-ink py-24">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-3xl font-semibold text-paper">Ship your first automation today</h2>
          <p className="mt-3 text-base text-ink-4">Pick a trigger, add a step, publish. Your first run can land before lunch.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/signup" className="rounded-sm bg-flame-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-flame-600">Create automation</Link>
            <Link href="/login" className="rounded-sm border border-ink-3 px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-2">Log in</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-flame-500 text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                </span>
                <span className="font-semibold text-ink">Zapflow</span>
              </div>
              <p className="mt-3 text-sm text-ink-3">Automations you can see through, step by step.</p>
            </div>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <h4 className="text-sm font-semibold text-ink">Product</h4>
                <ul className="mt-3 space-y-2 text-sm text-ink-2">
                  <li><a href="#how" className="hover:text-ink">How it works</a></li>
                  <li><a href="#faq" className="hover:text-ink">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink">Resources</h4>
                <ul className="mt-3 space-y-2 text-sm text-ink-2">
                  <li><span className="cursor-default">Privacy</span></li>
                  <li><span className="cursor-default">Terms</span></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink">Company</h4>
                <ul className="mt-3 space-y-2 text-sm text-ink-2">
                  <li><span className="cursor-default">All systems normal</span></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-line pt-6 text-sm text-ink-3">
            © Zapflow. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
