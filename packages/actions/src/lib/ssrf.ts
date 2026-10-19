import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const ALLOWED_PROTOCOLS = ["http:", "https:"] as const;
export const REQUEST_TIMEOUT_MS = 10000;
export const MAX_RESPONSE_BYTES = 1048576;
export const METADATA_IP = "169.254.169.254";

export const BLOCKED_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
];

export const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".internal",
  ".local",
  ".cluster.local",
  ".svc",
  ".svc.cluster.local",
];

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new SsrfError(`malformed ipv4 address: ${ip}`);
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((ipv4ToInt(ip) & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
}

export const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

export function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_IPV4_CIDRS.some((cidr) => inCidr(ip, cidr));
}

export function isBlockedIpv6(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("fe80")) return true;
  if (/^f[cd]/.test(value)) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  throw new SsrfError(`unrecognised address: ${ip}`);
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.includes(host)) return true;
  if (host === "kubernetes.default" || host === "kubernetes.default.svc") return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export type ResolveHost = (hostname: string) => Promise<string[]>;

export const defaultResolveHost: ResolveHost = async (hostname) => {
  const results = await lookup(hostname, { all: true });
  return results.map((r) => r.address);
};

export interface AssertSafeUrlOptions {
  allowlist?: string[];
  resolveHost?: ResolveHost;
}

export function isAllowlisted(hostname: string, allowlist: string[] = []): boolean {
  const host = hostname.toLowerCase();
  return allowlist.some((entry) => {
    const value = entry.toLowerCase();
    return host === value || host.endsWith(`.${value}`);
  });
}

export async function assertSafeUrl(
  rawUrl: string,
  options: AssertSafeUrlOptions = {},
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`invalid url: ${rawUrl}`);
  }

  if (!(ALLOWED_PROTOCOLS as readonly string[]).includes(url.protocol)) {
    throw new SsrfError(`protocol not allowed: ${url.protocol}`);
  }

  const { allowlist = [], resolveHost = defaultResolveHost } = options;

  if (isAllowlisted(url.hostname, allowlist)) {
    return url;
  }

  if (isBlockedHostname(url.hostname)) {
    throw new SsrfError(`hostname is blocked: ${url.hostname}`);
  }

  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal)) {
    if (isBlockedIp(literal)) {
      throw new SsrfError(`address is blocked: ${literal}`);
    }
    return url;
  }

  let addresses: string[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch (error) {
    throw new SsrfError(
      `dns lookup failed for ${url.hostname}: ${(error as Error).message}`,
    );
  }

  if (addresses.length === 0) {
    throw new SsrfError(`dns returned no addresses for ${url.hostname}`);
  }

  for (const address of addresses) {
    if (isBlockedIp(address)) {
      throw new SsrfError(
        `${url.hostname} resolves to blocked address ${address}`,
      );
    }
  }

  return url;
}
