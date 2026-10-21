import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("inline-flex h-6 items-center justify-center rounded-xs border border-line bg-sunken px-1.5 font-mono text-[11px] text-ink-3", className)} {...props} />;
}
