import type { ModelMessage } from "ai";
import { defineState } from "eve/context";

// Ordinary turns send one to three messages. More than this in one turn means
// something is replaying input or the model is not ending the turn.
const maxDeliveriesPerTurn = 4;

export const suppressedDeliveryNotice =
  "Not delivered: this turn already sent the maximum number of messages. End the turn now without calling another tool.";

const turnDeliveries = defineState<{ turnId: string; count: number }>(
  "open-instinct.turn-deliveries",
  () => ({ turnId: "", count: 0 })
);

export function admitDelivery(turnId: string) {
  return recordDelivery(turnId) <= maxDeliveriesPerTurn;
}

export function recordDelivery(turnId: string) {
  const current = turnDeliveries.get();
  const count = current.turnId === turnId ? current.count + 1 : 1;
  turnDeliveries.update(() => ({ turnId, count }));
  return count;
}

export function deliveriesInTurn(turnId: string) {
  const current = turnDeliveries.get();
  return current.turnId === turnId ? current.count : 0;
}

// Inbound message ids that already received a reply, so a later turn on the
// same message, such as a background task report, is not mistaken for an
// unanswered one.
const maximumAnsweredMessages = 50;

const answeredMessages = defineState<string[]>(
  "open-instinct.answered-messages",
  () => []
);

export function markMessageAnswered(messageId: string) {
  answeredMessages.update((current) =>
    [...current.filter((id) => id !== messageId), messageId].slice(
      -maximumAnsweredMessages
    )
  );
}

export function isMessageAnswered(messageId: string) {
  return answeredMessages.get().includes(messageId);
}

// Model resolvers do not receive the turn id, so detect a runaway from the
// history instead: the latest message is a delivery the guard refused.
export function endsWithSuppressedDelivery(messages: readonly ModelMessage[]) {
  const last = messages.at(-1);
  if (last?.role !== "tool") return false;
  return last.content.some(
    (part) =>
      part.type === "tool-result" &&
      part.output.type === "text" &&
      part.output.value === suppressedDeliveryNotice
  );
}
