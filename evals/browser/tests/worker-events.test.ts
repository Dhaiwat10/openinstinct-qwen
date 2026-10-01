import type { MessageStreamEvent, TaskSettledStreamEvent } from "eve/client";
import { describe, expect, it } from "vitest";
import {
  didCompleteWorker,
  didFinishWorker,
} from "@evals/browser/worker-events";

const started = {
  type: "task.started",
  data: {
    callId: "call_worker",
    taskId: "task_worker",
    turnId: "turn_0",
    name: "run_browser",
    kind: "tool",
  },
  meta: { at: "2026-08-27T18:00:00.000Z", id: "start" },
} satisfies MessageStreamEvent;
function settled(
  status: TaskSettledStreamEvent["data"]["status"],
  output?: TaskSettledStreamEvent["data"]["output"]
): MessageStreamEvent {
  return {
    type: "task.settled",
    data: { ...started.data, status, output },
    meta: { at: "2026-08-27T18:00:01.000Z", id: "settled" },
  };
}

describe("browser benchmark event detection", () => {
  it("reads a structured result from an attached worker session", () => {
    const completion = {
      type: "result.completed",
      data: {
        result: { images: [], message: "Done", status: "success" },
        sequence: 0,
        stepIndex: 0,
        turnId: "turn_0",
      },
      meta: started.meta,
    } satisfies MessageStreamEvent;
    expect(didCompleteWorker([completion])).toBe(true);
  });
  it("waits for task settlement instead of treating admission as completion", () => {
    expect(didFinishWorker([started])).toBe(false);
    expect(didCompleteWorker([started])).toBe(false);
    const events = [
      started,
      settled("completed", { images: [], message: "Done", status: "success" }),
    ];
    expect(didFinishWorker(events)).toBe(true);
    expect(didCompleteWorker(events)).toBe(true);
  });
  it("treats a structured failure as terminal but unsuccessful", () => {
    const events = [
      started,
      settled("completed", {
        images: [],
        message: "Failed",
        status: "failure",
      }),
    ];
    expect(didFinishWorker(events)).toBe(true);
    expect(didCompleteWorker(events)).toBe(false);
  });
  it.each(["failed", "cancelled"] as const)(
    "treats %s settlement as terminal",
    (status) => {
      const events = [started, settled(status)];
      expect(didFinishWorker(events)).toBe(true);
      expect(didCompleteWorker(events)).toBe(false);
    }
  );
  it("waits for a continued call even after the same task previously completed", () => {
    const events = [
      started,
      settled("completed", { images: [], message: "Done", status: "success" }),
      { ...started, data: { ...started.data, callId: "second_call" } },
    ];
    expect(didFinishWorker(events)).toBe(false);
    expect(didCompleteWorker(events)).toBe(false);
  });
});
