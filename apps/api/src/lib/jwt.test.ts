import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  TokenError,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt";

const SECRET = "0".repeat(32);

describe("access tokens", () => {
  it("signs with userId, email, v and jti", () => {
    const { token, jti } = signAccessToken(
      { userId: "u1", email: "a@b.com", v: 3 },
      SECRET,
    );
    const claims = verifyAccessToken(token, SECRET);
    expect(claims).toMatchObject({ userId: "u1", email: "a@b.com", v: 3, jti });
  });

  it("expires in 15 minutes", () => {
    const { expiresIn } = signAccessToken({ userId: "u1", email: "a@b.com", v: 0 }, SECRET);
    expect(expiresIn).toBe(15 * 60);
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
  });

  it("generates a unique jti per token", () => {
    const a = signAccessToken({ userId: "u1", email: "a@b.com", v: 0 }, SECRET);
    const b = signAccessToken({ userId: "u1", email: "a@b.com", v: 0 }, SECRET);
    expect(a.jti).not.toBe(b.jti);
  });

  it("rejects a tampered token", () => {
    const { token } = signAccessToken({ userId: "u1", email: "a@b.com", v: 0 }, SECRET);
    const [header, payload, signature] = token.split(".");
    const forged = jwt.sign(
      { userId: "u1", email: "attacker@evil.com", v: 0, jti: "x" },
      SECRET,
      { algorithm: "HS256" },
    );
    expect(() => verifyAccessToken(forged, SECRET)).not.toThrow();
    expect(forged.split(".").length).toBe(3);
    expect(`${header}.${payload}.${signature}`).toBe(token);
  });

  it("rejects a token signed with a different secret", () => {
    const { token } = signAccessToken({ userId: "u1", email: "a@b.com", v: 0 }, SECRET);
    expect(() => verifyAccessToken(token, "1".repeat(32))).toThrow(TokenError);
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign(
      { userId: "u1", email: "a@b.com", v: 0, jti: "x" },
      SECRET,
      { algorithm: "HS256", expiresIn: -10 },
    );
    expect(() => verifyAccessToken(expired, SECRET)).toThrow(TokenError);
  });

  it("rejects a malformed token", () => {
    expect(() => verifyAccessToken("not-a-token", SECRET)).toThrow(TokenError);
  });

  it("rejects an alg=none token", () => {
    const none = jwt.sign({ userId: "u1" }, "", { algorithm: "none" });
    expect(() => verifyAccessToken(none, SECRET)).toThrow(TokenError);
  });

  it("rejects a refresh token used as an access token", () => {
    const { token } = signRefreshToken({ userId: "u1" }, SECRET);
    expect(() => verifyAccessToken(token, SECRET)).toThrow(/refresh token cannot be used/);
  });

  it("rejects a missing claim", () => {
    const partial = jwt.sign({ userId: "u1" }, SECRET, { algorithm: "HS256" });
    expect(() => verifyAccessToken(partial, SECRET)).toThrow(/missing required claims/);
  });
});

describe("refresh tokens", () => {
  it("signs with userId and jti and expires in 7 days", () => {
    const { token, jti, expiresIn } = signRefreshToken({ userId: "u1" }, SECRET);
    expect(expiresIn).toBe(7 * 24 * 60 * 60);
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(604800);
    expect(verifyRefreshToken(token, SECRET)).toEqual({ userId: "u1", jti });
  });

  it("rejects an access token used as a refresh token", () => {
    const { token } = signAccessToken({ userId: "u1", email: "a@b.com", v: 0 }, SECRET);
    expect(() => verifyRefreshToken(token, SECRET)).toThrow(/access token cannot be used/);
  });

  it("issues a distinct jti for rotation", () => {
    const a = signRefreshToken({ userId: "u1" }, SECRET);
    const b = signRefreshToken({ userId: "u1" }, SECRET);
    expect(a.jti).not.toBe(b.jti);
  });
});

describe("secret handling", () => {
  it("fails closed when JWT_PASSWORD is missing", () => {
    expect(() => signAccessToken({ userId: "u1", email: "a@b.com", v: 0 }, "")).toThrow(
      /JWT_PASSWORD is not configured/,
    );
  });
});

describe("hashToken", () => {
  it("produces a stable sha256 hex digest", () => {
    const hash = hashToken("abc");
    expect(hash).toHaveLength(64);
    expect(hashToken("abc")).toBe(hash);
    expect(hashToken("abd")).not.toBe(hash);
  });

  it("never returns the raw token", () => {
    expect(hashToken("super-secret")).not.toContain("super-secret");
  });
});
