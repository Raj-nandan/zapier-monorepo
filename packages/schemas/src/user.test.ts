import { describe, expect, it } from "vitest";
import { forgotSchema, resetSchema, signinSchema, signupSchema } from "./user";

describe("email normalization", () => {
  it("trims and lowercases before validating the email", () => {
    const parsed = signupSchema.safeParse({
      username: "  MiXeD@Example.COM  ",
      password: "password123",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.username).toBe("mixed@example.com");
    }
  });

  it("normalizes on signin", () => {
    const parsed = signinSchema.safeParse({
      username: "  USER@EXAMPLE.COM ",
      password: "anything",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.username).toBe("user@example.com");
    }
  });

  it("normalizes on forgot", () => {
    const parsed = forgotSchema.safeParse({ email: "  Forgot@Example.com " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("forgot@example.com");
    }
  });

  it("still rejects a genuinely invalid email after trimming", () => {
    expect(signupSchema.safeParse({ username: "  not-an-email  ", password: "password123" }).success).toBe(
      false,
    );
  });
});

describe("password rules", () => {
  it("requires at least 8 characters on signup", () => {
    expect(signupSchema.safeParse({ username: "a@b.com", password: "short" }).success).toBe(false);
    expect(signupSchema.safeParse({ username: "a@b.com", password: "longenough" }).success).toBe(
      true,
    );
  });

  it("accepts any non empty password on signin", () => {
    expect(signinSchema.safeParse({ username: "a@b.com", password: "" }).success).toBe(false);
    expect(signinSchema.safeParse({ username: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("requires a token and a strong password on reset", () => {
    expect(resetSchema.safeParse({ token: "abc", password: "short" }).success).toBe(false);
    expect(resetSchema.safeParse({ token: "", password: "longenough" }).success).toBe(false);
    expect(resetSchema.safeParse({ token: "abc", password: "longenough" }).success).toBe(true);
  });
});
