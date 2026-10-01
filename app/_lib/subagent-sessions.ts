import type {
  MessageStreamEvent,
  AgentStartedStreamEvent,
  TaskSettledStreamEvent,
  TaskStartedStreamEvent,
} from "eve/client";

export type SubagentSession = AgentStartedStreamEvent["data"] & {
  readonly completion?: TaskSettledStreamEvent["data"];
  readonly task?: string;
};

export type SubagentStatus =
  | "cancelled"
  | "complete"
  | "failed"
  | "ready"
  | "starting"
  | "working";

export function collectSubagentSessions(
  events: readonly MessageStreamEvent[]
): readonly SubagentSession[] {
  const completions = new Map<string, TaskSettledStreamEvent["data"]>();
  const calls = new Map<string, TaskStartedStreamEvent["data"]>();
  const descriptions = new Map<string, string>();
  const sessions = new Map<string, SubagentSession>();
  const callOrder = new Map<string, number>();
  for (const [index, event] of events.entries()) {
    if (event.type === "task.started" || event.type === "agent.started") {
      if (event.type === "task.started" || !callOrder.has(event.data.callId))
        callOrder.set(event.data.callId, index);
    }
    if (event.type === "task.started") calls.set(event.data.taskId, event.data);
    if (event.type === "task.settled")
      completions.set(event.data.callId, event.data);
    if (event.type === "actions.requested") {
      for (const action of event.data.actions) {
        if (
          action.kind === "subagent-call" ||
          action.kind === "remote-agent-call"
        ) {
          descriptions.set(action.callId, action.description);
        }
      }
    }
  }
  for (const event of events) {
    if (event.type !== "agent.started") continue;
    const call = event.data.taskId ? calls.get(event.data.taskId) : undefined;
    const callId = call?.callId ?? event.data.callId;
    const session = {
      ...event.data,
      callId,
      turnId: call?.turnId ?? event.data.turnId,
      completion: completions.get(callId),
      task: descriptions.get(callId),
    };
    sessions.delete(session.sessionId);
    sessions.set(session.sessionId, session);
  }
  return [...sessions.values()].toSorted(
    (a, b) => (callOrder.get(b.callId) ?? 0) - (callOrder.get(a.callId) ?? 0)
  );
}

export function getSubagentSubscriptionKey(
  sessions: readonly SubagentSession[]
) {
  return sessions
    .map(
      (session) =>
        `${encodeURIComponent(session.sessionId)}:${encodeURIComponent(session.callId)}`
    )
    .join("\n");
}

export function getSubagentStatus(
  events: readonly MessageStreamEvent[],
  session: SubagentSession
): SubagentStatus {
  const terminalSession = events
    .toReversed()
    .find((event) =>
      ["session.completed", "session.failed"].includes(event.type)
    );
  if (terminalSession?.type === "session.completed") return "complete";
  if (terminalSession?.type === "session.failed") return "failed";
  const boundary = events
    .toReversed()
    .find((event) =>
      [
        "turn.cancelled",
        "turn.completed",
        "turn.failed",
        "turn.started",
      ].includes(event.type)
    );
  if (boundary?.type === "turn.failed") return "failed";
  if (boundary?.type === "turn.cancelled") return "cancelled";
  if (boundary?.type === "turn.completed") return "ready";
  if (boundary?.type === "turn.started") return "working";
  if (session.completion?.status === "failed") return "failed";
  if (session.completion?.status === "cancelled") return "cancelled";
  if (
    session.completion ||
    events.some((event) => event.type === "session.waiting")
  )
    return "ready";
  return "starting";
}

export function getSubagentTask(events: readonly MessageStreamEvent[]) {
  const message = events.find((event) => event.type === "message.received")
    ?.data.message;
  return message
    ?.split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^Task:\s*/iu, "");
}
