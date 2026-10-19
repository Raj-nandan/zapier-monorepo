import { describe, expect, it } from "vitest";
import {
  BCRYPT_COST_PRODUCTION,
  BCRYPT_COST_TEST,
  MIN_PASSWORD_LENGTH,
  PasswordError,
  bcryptCost,
  hashPassword,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  it("produces a bcrypt hash that verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("salts each hash uniquely", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password-here", a)).toBe(true);
    expect(await verifyPassword("same-password-here", b)).toBe(true);
  });

  it("never returns the plaintext", async () => {
    const hash = await hashPassword("plaintext-secret");
    expect(hash).not.toContain("plaintext-secret");
  });

  it("enforces the minimum length", async () => {
    await expect(hashPassword("short")).rejects.toThrow(PasswordError);
    await expect(hashPassword("1234567")).rejects.toThrow(/at least 8/);
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("returns false rather than throwing on empty input", async () => {
    expect(await verifyPassword("", "")).toBe(false);
  });

  it("uses cost 12 in production and 10 under test", () => {
    expect(BCRYPT_COST_PRODUCTION).toBe(12);
    expect(BCRYPT_COST_TEST).toBe(10);
    expect([BCRYPT_COST_PRODUCTION, BCRYPT_COST_TEST]).toContain(bcryptCost());
  });

  it("uses the lower cost while vitest runs so the suite stays fast", () => {
    expect(bcryptCost()).toBe(BCRYPT_COST_TEST);
  });
});
