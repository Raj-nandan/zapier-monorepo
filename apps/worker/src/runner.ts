import { prisma } from "@repo/db";
import { registry as actionRegistry, getHandler as getActionHandler } from "@repo/actions";
import { actionSlugFor } from "./slugs";
import { renderMetadata, truncateStepPayload } from "./parser";

export const MAX_ACTION_ATTEMPTS = 5;

export class RunnerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunnerError";
  }
}

export interface RunOutcome {
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "SUSPENDED";
  resumeAt?: Date;
  error?: string;
}

export interface StepOutcome {
  actionId: string;
  order: number;
  status: "SUCCESS" | "FAILED" | "SKIPPED" | "SUSPENDED";
  input: unknown;
  output: unknown;
  error?: string;
  latency: number;
}

async function alreadyExecuted(zapRunId: string, actionId: string): Promise<boolean> {
  const existing = await prisma.actionExecution.findUnique({
    where: { zapRunId_actionId: { zapRunId, actionId } },
  });
  return existing !== null;
}

export async function claimAction(zapRunId: string, actionId: string): Promise<boolean> {
  try {
    await prisma.actionExecution.create({ data: { zapRunId, actionId } });
    return true;
  } catch {
    return false;
  }
}

export async function runZapRun(zapRunId: string): Promise<RunOutcome> {
  const run = await prisma.zapRun.findUnique({
    where: { id: zapRunId },
    include: {
      zap: {
        include: {
          trigger: true,
          actions: { orderBy: { sortingOrder: "asc" } },
        },
      },
    },
  });

  if (!run) {
    await prisma.zapRun.updateMany({
      where: { id: zapRunId, status: { in: ["PENDING", "RUNNING", "SUSPENDED"] } },
      data: { status: "FAILED", error: "run not found" },
    });
    return { status: "FAILED", error: "run not found" };
  }

  if (run.status === "SUCCESS") {
    return { status: "SUCCESS" };
  }
  if (run.status === "FAILED") {
    return { status: "FAILED", error: run.error ?? undefined };
  }

  if (run.status === "SUSPENDED" && run.resumeAt && run.resumeAt.getTime() > Date.now()) {
    return { status: "SUSPENDED", resumeAt: run.resumeAt };
  }

  await prisma.zapRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", startedAt: run.startedAt ?? new Date(), error: null },
  });

  const context: Record<string, unknown> = {
    trigger: { output: run.metadata ?? {} },
  };

  for (const action of run.zap.actions) {
    if (await alreadyExecuted(run.id, action.id)) {
      continue;
    }
    if (!(await claimAction(run.id, action.id))) {
      continue;
    }

    const startedAt = Date.now();
    let input: unknown = {};
    let output: unknown = null;

    try {
      const slug = await actionSlugFor(action.availableActionId);
      const handler = getActionHandler(actionRegistry, slug);
      const metadata = renderMetadata(action.metadata ?? {}, context) as Record<string, unknown>;

      const existingStep = await prisma.zapRunStep.findUnique({
        where: { zapRunId_actionId: { zapRunId: run.id, actionId: action.id } },
      });
      input = existingStep?.input ?? truncateStepPayload(metadata);

      const outcome = await handler.run({
        metadata: metadata as never,
        context,
      });

      if (outcome.kind === "skip") {
        await writeStep(run.id, action.id, action.sortingOrder, "SKIPPED", input, null, outcome.reason, Date.now() - startedAt);
        return { status: "SKIPPED" };
      }

      if (outcome.kind === "suspend") {
        await writeStep(run.id, action.id, action.sortingOrder, "SUSPENDED", input, null, "delayed", Date.now() - startedAt);
        await prisma.zapRun.update({
          where: { id: run.id },
          data: { status: "SUSPENDED", resumeAt: outcome.resumeAt },
        });
        return { status: "SUSPENDED", resumeAt: outcome.resumeAt };
      }

      output = outcome.output;
      await writeStep(run.id, action.id, action.sortingOrder, "SUCCESS", input, output, undefined, Date.now() - startedAt);
      context[`step${action.sortingOrder + 1}`] = { output: output ?? {} };
    } catch (error) {
      const message = (error as Error).message;
      await writeStep(run.id, action.id, action.sortingOrder, "FAILED", input, null, message, Date.now() - startedAt);
      await prisma.zapRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      });
      return { status: "FAILED", error: message };
    }
  }

  await prisma.zapRun.update({
    where: { id: run.id },
    data: { status: "SUCCESS", finishedAt: new Date(), error: null },
  });
  return { status: "SUCCESS" };
}

async function writeStep(
  zapRunId: string,
  actionId: string,
  order: number,
  status: StepOutcome["status"],
  input: unknown,
  output: unknown,
  error: string | undefined,
  latency: number,
): Promise<void> {
  await prisma.zapRunStep.upsert({
    where: { zapRunId_actionId: { zapRunId, actionId } },
    update: { status, output: truncateStepPayload(output) as object, error, latency },
    create: {
      zapRunId,
      actionId,
      order,
      status,
      input: truncateStepPayload(input) as object,
      output: truncateStepPayload(output) as object,
      error,
      latency,
    },
  });
}
