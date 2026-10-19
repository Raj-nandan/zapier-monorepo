import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { seed } from "../prisma/seed";

export function testDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL_TEST;
  if (explicit) return explicit;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is required to run database tests");
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
  return url.toString();
}

export async function migrateTestDatabase(): Promise<void> {
  const require = createRequire(import.meta.url);
  const prismaCli = require.resolve("prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}

export async function seedTestDatabase(): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ActionExecution", "ZapRunStep", "ZapRunOutbox", "ZapRun", "Action", "Trigger",
      "WebhookSecret", "Zap", "Folder", "IdempotencyKey", "PasswordReset",
      "ConnectedAccount", "Account", "User", "AvailableAction", "AvailableTrigger"
    RESTART IDENTITY CASCADE;
  `);
  await seed(prisma);
}
