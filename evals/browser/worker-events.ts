import type { MessageStreamEvent, TaskSettledStreamEvent } from "eve/client";
import { taskCompletionOutputSchema } from "@agent/subagents/browser-agent/lib/completion";

interface WorkerTaskState {
  output?: TaskSettledStreamEvent["data"]["output"];
  status?: "cancelled" | "completed" | "failed";
  taskId: string;
  terminalAt?: string;
}

export function measureWorkerTask(
  events: readonly MessageStreamEvent[],
  fallbackDurationMs: number
) {
  const start = events.find((event) => event.type === "message.received")?.meta
    .at;
  const backgroundTasks = readWorkerTasks(events);
  const pendingWorker = backgroundTasks.some(
    (task) => task.status === undefined
  );
  const terminal =
    readTaskCompletion(events)?.completedAt ??
    (pendingWorker
      ? undefined
      : backgroundTasks.findLast((task) => task.terminalAt)?.terminalAt) ??
    events.findLast(
      (event) =>
        event.type === "session.failed" ||
        (!pendingWorker &&
          (event.type === "turn.failed" || event.type === "turn.cancelled"))
    )?.meta.at;
  let completedSteps = 0;
  let measuredSteps = 0;
  let costUsd = 0;
  let measuredInputTokenSteps = 0;
  let measuredOutputTokenSteps = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const event of events) {
    if (event.type !== "step.completed") continue;
    completedSteps += 1;

    const cost = event.data.usage?.costUsd;
    if (cost !== undefined) {
      measuredSteps += 1;
      costUsd += cost;
    }
    const input = event.data.usage?.inputTokens;
    if (input !== undefined) {
      measuredInputTokenSteps += 1;
      inputTokens += input;
    }
    const output = event.data.usage?.outputTokens;
    if (output !== undefined) {
      measuredOutputTokenSteps += 1;
      outputTokens += output;
    }
  }

  return {
    costComplete: completedSteps > 0 && measuredSteps === completedSteps,
    costUsd: measuredSteps === 0 ? null : costUsd,
    durationMs:
      start && terminal
        ? elapsedMs(start, terminal)
        : Math.max(0, fallbackDurationMs),
    inputTokens: measuredInputTokenSteps === 0 ? null : inputTokens,
    modelSteps: completedSteps,
    outputTokens: measuredOutputTokenSteps === 0 ? null : outputTokens,
  };
}

export function didCompleteWorker(events: readonly MessageStreamEvent[]) {
  return readTaskCompletion(events)?.status === "success";
}

export function didFinishWorker(events: readonly MessageStreamEvent[]) {
  const backgroundTasks = readWorkerTasks(events);
  if (backgroundTasks.length > 0) {
    return backgroundTasks.every((task) => task.status !== undefined);
  }
  return readTaskCompletion(events) !== undefined;
}

export function terminalWorkerMessage(
  message: string | undefined,
  events: readonly MessageStreamEvent[]
) {
  const completion = readTaskCompletion(events);
  if (completion) return normalizeMessage(completion.message);

  if (message?.trim()) return normalizeMessage(message);

  const failure = events.findLast(
    (event) => event.type === "turn.failed" || event.type === "session.failed"
  );

  return failure
    ? normalizeMessage(failure.data.message)
    : "No terminal message";
}

export function readTaskCompletion(events: readonly MessageStreamEvent[]) {
  const backgroundTasks = readWorkerTasks(events);
  if (backgroundTasks.length > 0) {
    if (backgroundTasks.some((task) => task.status === undefined)) {
      return undefined;
    }

    const latest = backgroundTasks.at(-1);
    if (latest?.status === "completed" && latest.output && latest.terminalAt) {
      const completion = taskCompletionOutputSchema.safeParse(latest.output);
      if (completion.success) {
        return { ...completion.data, completedAt: latest.terminalAt };
      }
    }
    return undefined;
  }

  for (const event of events.toReversed()) {
    if (event.type === "result.completed") {
      const completion = taskCompletionOutputSchema.safeParse(
        event.data.result
      );
      if (completion.success) {
        return { ...completion.data, completedAt: event.meta.at };
      }
      continue;
    }

    if (event.type !== "action.result" || event.data.status !== "completed") {
      continue;
    }

    const result = event.data.result;
    if (result.kind === "subagent-result") {
      if (
        result.subagentName === "browser-agent" &&
        (result.origin !== "child" || result.outcome.kind !== "parked")
      ) {
        const completion = taskCompletionOutputSchema.safeParse(result.output);
        if (completion.success) {
          return { ...completion.data, completedAt: event.meta.at };
        }
      }
      continue;
    }
  }

  return undefined;
}

function readWorkerTasks(events: readonly MessageStreamEvent[]) {
  const tasks = new Map<string, WorkerTaskState>();
  for (const event of events) {
    if (
      event.type === "task.started" &&
      ["run_browser", "browser-agent"].includes(event.data.name)
    ) {
      tasks.delete(event.data.callId);
      tasks.set(event.data.callId, { taskId: event.data.taskId });
    }
    if (event.type === "task.settled" && tasks.has(event.data.callId)) {
      tasks.set(event.data.callId, {
        taskId: event.data.taskId,
        output: event.data.output,
        status: event.data.status,
        terminalAt: event.meta.at,
      });
    }
  }
  return [...tasks.values()];
}

function elapsedMs(start: string, end: string) {
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

function normalizeMessage(message: string) {
  return message.replaceAll(/\s+/gu, " ").trim();
}
