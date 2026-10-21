"use client";

import { useEffect, useState } from "react";

let redirecting = false;

export async function ensureCsrf(): Promise<string | null> {
  try {
    const res = await fetch("/api/v1/csrf", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.csrfToken === "string" ? data.csrfToken : null;
  } catch {
    return null;
  }
}

export function useAuthRedirect() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(true);
  }, []);
  return done;
}

export function handleUnauthorized() {
  if (redirecting) return;
  redirecting = true;
  if (typeof window !== "undefined") {
    const safe = window.location.pathname;
    window.location.href = `/login?next=${encodeURIComponent(safe)}`;
  }
}
