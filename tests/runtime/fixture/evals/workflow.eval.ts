import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { defineEval, type EveEvalContext } from "eve/evals";
import { equals } from "eve/evals/expect";
import type { MessageStreamEvent } from "eve/client";
import { taskCompletionOutputSchema } from "@agent/subagents/browser-agent/lib/completion";

async function waitForToolMarker(
  sessionId: string,
  marker: "started" | "aborted",
  signal: AbortSignal
) {
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  while (!existsSync(join(".eve", "fixture-tool", sessionId, marker))) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- bounded observation of the runtime worker's cancellation marker.
    await setTimeout(10, undefined, { signal: deadline });
  }
}

function calledAgent(events: readonly MessageStreamEvent[]) {
  const opened = events.find((event) => event.type === "agent.started");
  if (!opened) throw new Error("No child session was recorded.");
  return opened;
}
function checkCompletion(
  t: EveEvalContext,
  events: readonly MessageStreamEvent[]
) {
  const completed = events.findLast(
    (event) =>
      event.type === "task.settled" &&
      event.data.name === "run_browser" &&
      event.data.status === "completed"
  );
  if (completed?.type !== "task.settled")
    throw new Error("No browser task completion was recorded.");
  t.check(
    taskCompletionOutputSchema.parse(completed.data.output),
    equals({
      images: [],
      status: "success",
      message: "Verified fixture outcome",
    })
  );
}

export default [
  defineEval({
    description:
      "Completes browser work and resumes the same structured worker task",
    async test(t) {
      const first = await t.send("Start");
      first.expectOk();
      checkCompletion(t, first.events);
      const opened = calledAgent(first.events);
      if (!opened.data.taskId)
        throw new Error("Browser task identity missing.");
      const continued = await first.session.send(
        `Resume:${opened.data.taskId}`
      );
      continued.expectOk();
      checkCompletion(t, continued.events);
      const resumed = continued.events.find(
        (event) =>
          event.type === "task.started" && event.data.name === "run_browser"
      );
      if (resumed?.type !== "task.started")
        throw new Error("Task continuation missing.");
      t.check(resumed.data.taskId, equals(opened.data.taskId));
      t.check(
        continued.events.some((event) => event.type === "agent.started"),
        equals(false)
      );
    },
  }),
  defineEval({
    description: "Cancels running browser work and reuses its worker session",
    async test(t) {
      const session = await t.session();
      const activity = await session.start("Wait");
      const opened = await activity.waitForEvent("agent.started");
      t.log("Opened browser session");
      if (!opened.data.taskId)
        throw new Error("Browser task identity missing.");
      await waitForToolMarker(opened.data.sessionId, "started", t.signal);
      t.log("Browser tool running");
      const cancelled = await session.send(`Cancel:${opened.data.taskId}`, {
        turnPolicy: "steer",
      });
      t.log("Cancellation turn settled");
      cancelled.expectOk();
      const first = await activity.result();
      t.log("Initial turn settled");
      first.expectOk();
      cancelled.calledTool("task_cancel", { status: "completed", count: 1 });
      await waitForToolMarker(opened.data.sessionId, "aborted", t.signal);
      const settlements = [...first.events, ...cancelled.events].filter(
        (event) => event.type === "task.settled"
      );
      t.check(
        settlements.some(
          (event) =>
            event.data.taskId === opened.data.taskId &&
            event.data.status === "cancelled"
        ),
        equals(true)
      );
      const resumed = await cancelled.session.send(
        `Resume:${opened.data.taskId}`
      );
      resumed.expectOk();
      checkCompletion(t, resumed.events);
      t.check(
        resumed.events.some((event) => event.type === "agent.started"),
        equals(false)
      );
    },
  }),
];
