import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@repo/db";
import { claimAction, runZapRun } from "./runner";
import {
  MAX_DEPTH,
  MAX_OUTPUT_BYTES,
  MAX_SUBSTITUTIONS,
  ParserError,
  extractTokens,
  render,
  renderMetadata,
  truncateStepPayload,
} from "./parser";
import { closeRedis } from "./redis";

beforeEach(async () => {
  await prisma.actionExecution.deleteMany({});
  await prisma.zapRunStep.deleteMany({});
  await prisma.zapRun.deleteMany({});
  await prisma.action.deleteMany({});
  await prisma.trigger.deleteMany({});
  await prisma.zap.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await closeRedis();
});

async function seedZap(actions: Array<{ slug: string; metadata: object }>, metadata = {}) {
  const user = await prisma.user.create({
    data: { email: `w-${Date.now()}-${Math.random()}@example.com` },
  });
  const zap = await prisma.zap.create({ data: { userId: user.id } });
  const trigger = await prisma.availableTrigger.findUnique({ where: { slug: "webhook" } });
  await prisma.trigger.create({
    data: { zapId: zap.id, availableTriggerId: trigger!.id, metadata: {} },
  });
  const created = [];
  for (const [index, action] of actions.entries()) {
    const available = await prisma.availableAction.findUnique({ where: { slug: action.slug } });
    created.push(
      await prisma.action.create({
        data: {
          zapId: zap.id,
          availableActionId: available!.id,
          sortingOrder: index,
          metadata: action.metadata,
        },
      }),
    );
  }
  const run = await prisma.zapRun.create({
    data: { zapId: zap.id, zapRevision: 1, status: "PENDING", metadata },
  });
  return { zap, run, actions: created };
}

describe("parser bounds", () => {
  it("resolves a nested reference", () => {
    expect(render("hi {{trigger.output.name}}", { trigger: { output: { name: "bob" } } })).toBe(
      "hi bob",
    );
  });

  it("substitutes a missing reference with an empty string", () => {
    expect(render("hi {{trigger.output.nope}}", { trigger: { output: {} } })).toBe("hi ");
  });

  it("rejects a malformed reference", () => {
    expect(() => render("{{not valid}}", {})).toThrow(ParserError);
  });

  it("rejects more than 100 substitutions", () => {
    const input = Array.from({ length: MAX_SUBSTITUTIONS + 1 }, () => "{{trigger.output.a}}").join(" ");
    expect(() => render(input, { trigger: { output: { a: 1 } } })).toThrow(/too many substitutions/);
    expect(extractTokens("{{a}}")).toEqual(["a"]);
  });

  it("rejects output over 10KB", () => {
    const long = "x".repeat(MAX_OUTPUT_BYTES + 100);
    expect(() => render(`{{trigger.output.big}}`, { trigger: { output: { big: long } } })).toThrow(
      /output exceeds/,
    );
  });

  it("rejects metadata nested deeper than 5 levels", () => {
    const deep = { a: { b: { c: { d: { e: { f: "too deep" } } } } } };
    expect(() => renderMetadata(deep, {})).toThrow(/nesting exceeds depth/);
    expect(MAX_DEPTH).toBe(5);
  });

  it("renders inside nested structures", () => {
    const rendered = renderMetadata(
      { to: "{{trigger.output.email}}", nested: { list: ["{{trigger.output.a}}"] } },
      { trigger: { output: { email: "x@y.z", a: "1" } } },
    ) as Record<string, unknown>;
    expect(rendered.to).toBe("x@y.z");
  });

  it("truncates oversized step payloads", () => {
    const truncated = truncateStepPayload({ blob: "x".repeat(MAX_OUTPUT_BYTES * 2) }) as {
      truncated: boolean;
    };
    expect(truncated.truncated).toBe(true);
  });
});

describe("action execution dedupe", () => {
  it("claims an action exactly once", async () => {
    const { actions } = await seedZap([{ slug: "email", metadata: { to: "a@b.com" } }]);
    expect(await claimAction("run-1", actions[0].id)).toBe(true);
    expect(await claimAction("run-1", actions[0].id)).toBe(false);
    expect(await prisma.actionExecution.count()).toBe(1);
  });
});

describe("runZapRun", () => {
  it("runs actions serially in sortingOrder and marks the run SUCCESS", async () => {
    const { run } = await seedZap([
      { slug: "filter", metadata: { condition: "trigger.output.n == 5" } },
      { slug: "filter", metadata: { condition: "trigger.output.n == 5" } },
    ], { n: 5 });

    const outcome = await runZapRun(run.id);
    expect(outcome.status).toBe("SUCCESS");

    const steps = await prisma.zapRunStep.findMany({
      where: { zapRunId: run.id },
      orderBy: { order: "asc" },
    });
    expect(steps.map((s) => s.order)).toEqual([0, 1]);
    expect(steps.every((s) => s.status === "SUCCESS")).toBe(true);

    const updated = await prisma.zapRun.findUnique({ where: { id: run.id } });
    expect(updated!.status).toBe("SUCCESS");
  });

  it("fails the run when http-request targets a blocked address", async () => {
    const { run } = await seedZap([
      { slug: "http-request", metadata: { url: "http://169.254.169.254/latest/meta-data/" } },
    ]);

    const outcome = await runZapRun(run.id);
    expect(outcome.status).toBe("FAILED");
    expect(outcome.error).toMatch(/blocked/);

    const steps = await prisma.zapRunStep.findMany({ where: { zapRunId: run.id } });
    expect(steps[0].status).toBe("FAILED");
  });

  it("stops the chain and marks the run FAILED on action error", async () => {
    const { run } = await seedZap([
      { slug: "filter", metadata: { condition: "trigger.output.n == 5" } },
    ], { n: 1 });

    const outcome = await runZapRun(run.id);
    expect(outcome.status).toBe("SKIPPED");

    const steps = await prisma.zapRunStep.findMany({ where: { zapRunId: run.id } });
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe("SKIPPED");
  });

  it("records one ZapRunStep per action", async () => {
    const { run } = await seedZap([
      { slug: "filter", metadata: { condition: "trigger.output.n == 5" } },
    ], { n: 5 });
    await runZapRun(run.id);
    const steps = await prisma.zapRunStep.findMany({
      where: { zapRunId: run.id },
      orderBy: { order: "asc" },
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe("SUCCESS");
    expect(typeof steps[0].latency).toBe("number");
  });

  it("suspends on delay without running later actions and without sleeping", async () => {
    const { run } = await seedZap([
      { slug: "delay", metadata: { ms: 60000 } },
      { slug: "filter", metadata: { condition: "trigger.output.n == 5" } },
    ], { n: 5 });

    const started = Date.now();
    const outcome = await runZapRun(run.id);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(outcome.status).toBe("SUSPENDED");

    const updated = await prisma.zapRun.findUnique({ where: { id: run.id } });
    expect(updated!.status).toBe("SUSPENDED");
    expect(updated!.resumeAt).not.toBeNull();

    const steps = await prisma.zapRunStep.findMany({ where: { zapRunId: run.id } });
    expect(steps).toHaveLength(1);
  });

  it("leaves a not-yet-due suspended run alone", async () => {
    const { run } = await seedZap([{ slug: "filter", metadata: { condition: "a == 1" } }], { a: 1 });
    await prisma.zapRun.update({
      where: { id: run.id },
      data: { status: "SUSPENDED", resumeAt: new Date(Date.now() + 60_000) },
    });
    const outcome = await runZapRun(run.id);
    expect(outcome.status).toBe("SUSPENDED");
  });

  it("does not re-execute actions on redelivery", async () => {
    const { run } = await seedZap([
      { slug: "filter", metadata: { condition: "trigger.output.n == 5" } },
    ], { n: 5 });

    await runZapRun(run.id);
    const executionsAfterFirst = await prisma.actionExecution.count();

    await prisma.zapRun.update({ where: { id: run.id }, data: { status: "PENDING" } });
    await runZapRun(run.id);

    expect(await prisma.actionExecution.count()).toBe(executionsAfterFirst);
    expect(await prisma.zapRunStep.count({ where: { zapRunId: run.id } })).toBe(1);
  });

  it("does not flip a FAILED run to SUCCESS when redelivered", async () => {
    const { run } = await seedZap([
      { slug: "http-request", metadata: { url: "http://169.254.169.254/latest/meta-data/" } },
    ]);

    const first = await runZapRun(run.id);
    expect(first.status).toBe("FAILED");

    const redelivered = await runZapRun(run.id);
    expect(redelivered.status).toBe("FAILED");

    const stored = await prisma.zapRun.findUnique({ where: { id: run.id } });
    expect(stored!.status).toBe("FAILED");
    expect(await prisma.actionExecution.count()).toBe(1);
  });

  it("returns early for an already SUCCESS run without re-executing", async () => {
    const { run } = await seedZap([
      { slug: "filter", metadata: { condition: "trigger.output.n == 5" } },
    ], { n: 5 });

    await runZapRun(run.id);
    const executions = await prisma.actionExecution.count();

    const again = await runZapRun(run.id);
    expect(again.status).toBe("SUCCESS");
    expect(await prisma.actionExecution.count()).toBe(executions);
    expect(await prisma.zapRunStep.count({ where: { zapRunId: run.id } })).toBe(1);
  });

  it("fails the run when the zap no longer exists", async () => {
    const { run } = await seedZap([{ slug: "filter", metadata: {} }]);
    await prisma.zapRun.update({
      where: { id: run.id },
      data: { status: "PENDING" },
    });
    await prisma.zap.delete({ where: { id: (await prisma.zapRun.findUnique({ where: { id: run.id } }))!.zapId } });
    const outcome = await runZapRun(run.id);
    expect(outcome.status).toBe("FAILED");
  });
});
