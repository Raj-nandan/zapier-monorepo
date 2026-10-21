export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/dashboard";
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/dashboard";
  }
  if (decoded.length === 0 || decoded.length > 512) return "/dashboard";
  if (/\s/.test(decoded)) return "/dashboard";
  if (!decoded.startsWith("/")) return "/dashboard";
  if (decoded.startsWith("//")) return "/dashboard";
  if (decoded.includes("\\")) return "/dashboard";
  const pathOnly = decoded.split("?")[0].split("#")[0];
  if (pathOnly.includes(":")) {
    const colonIdx = pathOnly.indexOf(":");
    if (colonIdx !== -1) return "/dashboard";
  }
  const allowed = [
    /^\/dashboard$/,
    /^\/analytics$/,
    /^\/history$/,
    /^\/settings$/,
    /^\/zap\/create$/,
    /^\/zap\/[A-Za-z0-9_-]{1,64}$/,
  ];
  const authRoutes = new Set(["/login", "/signup", "/forgot", "/reset", "/auth/callback"]);
  if (authRoutes.has(pathOnly)) return "/dashboard";
  if (!allowed.some((re) => re.test(pathOnly))) return "/dashboard";
  return pathOnly;
}
