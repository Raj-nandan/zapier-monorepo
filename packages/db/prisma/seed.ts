import { PrismaClient } from "@prisma/client";

export const TRIGGERS = [
  { slug: "webhook", name: "Webhook" },
  { slug: "schedule", name: "Schedule" },
  { slug: "github-poll", name: "GitHub Poll" },
  { slug: "rss-poll", name: "RSS Poll" },
  { slug: "manual", name: "Manual" },
];

export const ACTIONS = [
  { slug: "email", name: "Send Email" },
  { slug: "slack", name: "Slack Message" },
  { slug: "discord", name: "Discord Message" },
  { slug: "http-request", name: "HTTP Request" },
  { slug: "delay", name: "Delay" },
  { slug: "filter", name: "Filter" },
];

export async function seed(prisma: PrismaClient) {
  for (const t of TRIGGERS) {
    await prisma.availableTrigger.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
    });
  }
  for (const a of ACTIONS) {
    await prisma.availableAction.upsert({
      where: { slug: a.slug },
      update: { name: a.name },
      create: a,
    });
  }
  return { triggers: TRIGGERS.length, actions: ACTIONS.length };
}

if (import.meta.main) {
  const prisma = new PrismaClient();
  try {
    const result = await seed(prisma);
    console.log(`Seeded ${result.triggers} triggers, ${result.actions} actions`);
  } finally {
    await prisma.$disconnect();
  }
}
