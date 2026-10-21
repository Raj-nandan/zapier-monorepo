import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "running" | "failed" | "suspended" | "outline";
}

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-sunken text-ink-2",
  success: "bg-status-success-bg text-status-success",
  running: "bg-status-running-bg text-status-running",
  failed: "bg-status-failed-bg text-status-failed",
  suspended: "bg-status-suspended-bg text-status-suspended",
  outline: "bg-transparent text-ink-2 border border-line-strong",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
