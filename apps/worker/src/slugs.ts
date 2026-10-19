import { prisma } from "@repo/db";

export async function actionSlugFor(id: string): Promise<string> {
  const row = await prisma.availableAction.findUnique({ where: { id } });
  if (!row) throw new Error("unknown action");
  return row.slug;
}
