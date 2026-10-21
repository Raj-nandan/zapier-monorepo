import { describe, it, expect } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("rejects external and malformed inputs", () => {
    const bad = [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "/%2F%2Fevil.com",
      "/%5Cevil.com",
      "javascript:alert(1)",
      "data:text/html,x",
      "/dashboard%0d%0aSet-Cookie:x",
      " /dashboard",
      "/login?next=/login",
      "a".repeat(600),
      "/zap/..%2Fadmin",
    ];
    for (const v of bad) expect(safeNext(v)).toBe("/dashboard");
  });
  it("accepts valid internal paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/history")).toBe("/history");
    expect(safeNext("/zap/create")).toBe("/zap/create");
    expect(safeNext("/zap/abc_123")).toBe("/zap/abc_123");
    expect(safeNext("/settings")).toBe("/settings");
  });
  it("drops query and hash", () => {
    expect(safeNext("/dashboard?x=1#y")).toBe("/dashboard");
  });
  it("rejects auth routes", () => {
    expect(safeNext("/login")).toBe("/dashboard");
    expect(safeNext("/signup")).toBe("/dashboard");
  });
  it("handles non-string", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext(42)).toBe("/dashboard");
  });
});
