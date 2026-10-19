import bcrypt from "bcryptjs";
import { env } from "@repo/config";

export const BCRYPT_COST_PRODUCTION = 12;
export const BCRYPT_COST_TEST = 10;
export const MIN_PASSWORD_LENGTH = 8;

export class PasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordError";
  }
}

export function bcryptCost(): number {
  return env.NODE_ENV === "test" || process.env.VITEST ? BCRYPT_COST_TEST : BCRYPT_COST_PRODUCTION;
}

export function assertPasswordStrength(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordStrength(password);
  return bcrypt.hash(password, bcryptCost());
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}
