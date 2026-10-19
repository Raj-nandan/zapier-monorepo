import { describe, expect, it } from "vitest";
import {
  BLOCKED_IPV4_CIDRS,
  MAX_RESPONSE_BYTES,
  METADATA_IP,
  REQUEST_TIMEOUT_MS,
  SsrfError,
  assertSafeUrl,
  isAllowlisted,
  isBlockedHostname,
  isBlockedIp,
} from "./ssrf";

const publicResolver = async () => ["93.184.216.34"];

describe("protocol allowlist", () => {
  it("allows http and https", async () => {
    await expect(
      assertSafeUrl("https://example.com/x", { resolveHost: publicResolver }),
    ).resolves.toBeInstanceOf(URL);
    await expect(
      assertSafeUrl("http://example.com/x", { resolveHost: publicResolver }),
    ).resolves.toBeInstanceOf(URL);
  });

  it("rejects non http protocols", async () => {
    for (const url of ["file:///etc/passwd", "ftp://example.com", "gopher://x"]) {
      await expect(assertSafeUrl(url)).rejects.toThrow(/protocol not allowed/);
    }
  });

  it("rejects a malformed url", async () => {
    await expect(assertSafeUrl("not a url")).rejects.toThrow(/invalid url/);
  });
});

describe("blocked ip ranges", () => {
  it("blocks the cloud metadata endpoint", () => {
    expect(METADATA_IP).toBe("169.254.169.254");
    expect(isBlockedIp(METADATA_IP)).toBe(true);
  });

  it("blocks loopback, private and link-local v4", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.4.1", "192.168.1.1", "0.0.0.0", "100.64.1.1"]) {
      expect(isBlockedIp(ip)).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "1.1.1.1"]) {
      expect(isBlockedIp(ip)).toBe(false);
    }
  });

  it("covers every documented cidr", () => {
    expect(BLOCKED_IPV4_CIDRS).toContain("169.254.0.0/16");
    expect(BLOCKED_IPV4_CIDRS.length).toBeGreaterThanOrEqual(10);
  });

  it("blocks ipv6 loopback, unique-local and mapped v4", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fd00::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });
});

describe("blocked hostnames", () => {
  it("blocks cluster dns and metadata names", () => {
    for (const host of [
      "localhost",
      "kubernetes.default",
      "kubernetes.default.svc",
      "db.prod.svc.cluster.local",
      "metadata.google.internal",
    ]) {
      expect(isBlockedHostname(host)).toBe(true);
    }
  });

  it("allows normal public names", () => {
    for (const host of ["example.com", "api.github.com", "slack.com"]) {
      expect(isBlockedHostname(host)).toBe(false);
    }
  });
});

describe("dns resolution checks", () => {
  it("blocks a public name that resolves to a private address", async () => {
    await expect(
      assertSafeUrl("https://evil.example.com/", {
        resolveHost: async () => ["169.254.169.254"],
      }),
    ).rejects.toThrow(/resolves to blocked address/);
  });

  it("blocks a name with any blocked address among several", async () => {
    await expect(
      assertSafeUrl("https://mixed.example.com/", {
        resolveHost: async () => ["93.184.216.34", "10.0.0.9"],
      }),
    ).rejects.toThrow(SsrfError);
  });

  it("rejects when dns returns nothing", async () => {
    await expect(
      assertSafeUrl("https://empty.example.com/", { resolveHost: async () => [] }),
    ).rejects.toThrow(/no addresses/);
  });

  it("rejects when dns lookup fails", async () => {
    await expect(
      assertSafeUrl("https://nx.example.com/", {
        resolveHost: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
    ).rejects.toThrow(/dns lookup failed/);
  });

  it("checks a literal ip without resolving", async () => {
    await expect(
      assertSafeUrl("http://127.0.0.1/admin", {
        resolveHost: async () => {
          throw new Error("should not resolve");
        },
      }),
    ).rejects.toThrow(/address is blocked/);
  });
});

describe("explicit allowlist overrides the guard", () => {
  it("permits an allowlisted host even when blocked", async () => {
    await expect(
      assertSafeUrl("http://10.0.0.5/internal", { allowlist: ["10.0.0.5"] }),
    ).resolves.toBeInstanceOf(URL);
  });

  it("permits a subdomain of an allowlisted parent", async () => {
    await expect(
      assertSafeUrl("https://api.internal.corp/", { allowlist: ["internal.corp"] }),
    ).resolves.toBeInstanceOf(URL);
  });

  it("matches allowlist entries case insensitively", () => {
    expect(isAllowlisted("API.Example.com", ["example.com"])).toBe(true);
    expect(isAllowlisted("api.example.com", ["EXAMPLE.COM"])).toBe(true);
    expect(isAllowlisted("api.evil.com", ["example.com"])).toBe(false);
  });
});

describe("documented limits", () => {
  it("pins the 10s timeout and 1MB response cap", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10000);
    expect(MAX_RESPONSE_BYTES).toBe(1048576);
  });
});
