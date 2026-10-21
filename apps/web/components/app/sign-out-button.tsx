"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  async function handleSignOut() {
    setLoading(true);
    try {
      await apiFetch("/user/logout", { method: "POST" });
    } catch {
      // ignore
    }
    window.location.href = "/login";
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm text-ink-2 hover:text-ink disabled:opacity-50"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
