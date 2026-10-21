const ALLOWED = [
  /^\/dashboard$/,
  /^\/analytics$/,
  /^\/history$/,
  /^\/settings$/,
  /^\/zap\/create$/,
  /^\/zap\/[A-Za-z0-9_-]{1,64}$/,
];

const AUTH_ROUTES = new Set(["/login", "/signup", "/forgot", "/reset", "/auth/callback"]);

export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/dashboard";
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/dashboard";
  }
  // trim nothing: leading whitespace rejects
  if (decoded.length === 0 || decoded.length > 512) return "/dashboard";
  if (decoded !== decoded.trimStart() === false && decoded !== decoded.trim() ) {
    // reject any leading/trailing whitespace
  }
  // reject whitespace entirely (leading/trailing/control)
  if (/\s/.test(decoded)) return "/dashboard";
  if (!decoded.startsWith("/")) return "/dashboard";
  if (decoded.startsWith("//")) return "/dashboard";
  if (decoded.includes("\\")) return "/dashboard";
  if (decoded.includes("\u0000")) return "/dashboard";
  // control characters
  for (let i = 0; i < decoded.length; i++) {
    const c = decoded.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return "/dashboard";
  }
  // scheme check: ':' before first '/'
  // path is everything up to query/hash
  const pathOnly = decoded.split("?")[0].split("#")[0];
  // ensure single leading slash
  if (!/^\/[^/]/.test(pathOnly) && pathOnly !== "/") {
    // allow exactly "/"? allowlist doesn't include "/", so will fail anyway
  }
  if (pathOnly.includes(":")) {
    // scheme-like: reject if colon appears before any slash after the first
    const colonIdx = pathOnly.indexOf(":");
    if (colonIdx !== -1 && colonIdx < pathOnly.indexOf("/", 1)) return "/dashboard";
  }
  if (AUTH_ROUTES.has(pathOnly)) return "/dashboard";
  if (!ALLOWED.some((re) => re.test(pathOnly))) return "/dashboard";
  return pathOnly;
}
