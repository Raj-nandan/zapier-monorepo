import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { safeNext } from "./lib/safeNext";

const PROTECTED = ["/dashboard", "/analytics", "/history", "/settings", "/zap"];
const AUTH_ONLY = ["/login", "/signup", "/forgot"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("access_token")?.value);

  // Generate CSP nonce for every request
  const nonce = btoa(crypto.randomUUID());
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // Build CSP with nonce
  const isProd = process.env.NODE_ENV === "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  function applyHeaders(res: NextResponse) {
    res.headers.set("x-nonce", nonce);
    res.headers.set("Content-Security-Policy", csp);
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", safeNext(pathname));
      return applyHeaders(NextResponse.redirect(url));
    }
  }
  if ((AUTH_ONLY.includes(pathname) || pathname === "/") && hasSession) {
    return applyHeaders(NextResponse.redirect(new URL("/dashboard", req.url)));
  }

  // Referrer-Policy override for sensitive routes
  const res = applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }));
  if (pathname === "/reset" || pathname === "/auth/callback") {
    res.headers.set("Referrer-Policy", "no-referrer");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
