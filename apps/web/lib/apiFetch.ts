import { QueryClient } from "@tanstack/react-query";

let redirecting = false;

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  }
  if (typeof document !== "undefined") {
    const csrf = document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1];
    if (csrf && method !== "GET" && method !== "HEAD") headers.set("X-CSRF-Token", csrf);
  }
  if (method !== "GET" && method !== "HEAD" && !headers.has("Idempotency-Key")) {
    headers.set("Idempotency-Key", crypto.randomUUID());
  }
  const res = await fetch(`/api/v1${path}`, { ...init, headers, credentials: "include" });
  const isAuthPath =
    path.startsWith("/user/signin") ||
    path.startsWith("/user/signup") ||
    path.startsWith("/user/forgot") ||
    path.startsWith("/user/reset") ||
    path.startsWith("/auth/");
  const isAuthPage =
    typeof window !== "undefined" &&
    ["/login", "/signup", "/forgot", "/reset"].some((p) => window.location.pathname.startsWith(p));

  if (res.status === 401 && !isAuthPath && !isAuthPage && typeof window !== "undefined" && !redirecting) {
    redirecting = true;
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  return res;
}

export const queryClient = new QueryClient();
