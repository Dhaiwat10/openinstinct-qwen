import type { ModelMessage } from "ai";
import type { DynamicResolveContext } from "eve/tools";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessageToolResultSchema } from "@shared/chat/message-delivery";
import { toolContextFor } from "../helpers/tool-context";

const stateControls = vi.hoisted(() => ({
  // SAFETY: The array is populated only with zero-argument reset callbacks created by this mock.
  reset: [] as (() => void)[],
}));

vi.mock("eve/context", () => ({
  defineState<T>(_name: string, initial: () => T) {
    let value = initial();
    stateControls.reset.push(() => {
      value = initial();
    });
    return {
      get: () => value,
      update(update: (current: T) => T) {
        value = update(value);
      },
    };
  },
}));

import {
  endsWithSuppressedDelivery,
  suppressedDeliveryNotice,
} from "@agent/lib/delivery-guard";
import messaging from "@agent/tools/messaging";

beforeEach(() => {
  for (const reset of stateControls.reset) reset();
});

describe("send_message delivery guard", () => {
  it("suppresses deliveries past the per-turn limit and tells the model to stop", async () => {
    const sendMessage = await resolveSendMessage();
    const message = { kind: "message" as const, text: "hey" };
    const context = toolContextFor({ toolName: "send_message" });

    const outputs = Array.from({ length: 6 }, () =>
      sendMessage.execute(message, context)
    );

    expect(outputs.slice(0, 4)).toEqual(
      Array.from({ length: 4 }, () => message)
    );
    expect(outputs.slice(4)).toEqual([
      { kind: "suppressed" },
      { kind: "suppressed" },
    ]);
    expect(
      sendMessageToolResultSchema.safeParse({
        kind: "tool-result",
        output: outputs[4],
        toolName: "send_message",
      }).success
    ).toBe(false);
    expect(await sendMessage.toModelOutput?.({ kind: "suppressed" })).toEqual({
      type: "text",
      value: suppressedDeliveryNotice,
    });
  });

  it("starts a fresh allowance on the next turn", async () => {
    const sendMessage = await resolveSendMessage();
    const message = { kind: "message" as const, text: "hey" };
    const firstTurn = toolContextFor({ toolName: "send_message" });
    const firstTurnOutputs = Array.from({ length: 5 }, () =>
      sendMessage.execute(message, firstTurn)
    );
    expect(firstTurnOutputs.at(-1)).toEqual({ kind: "suppressed" });

    const nextTurn = {
      ...firstTurn,
      session: { ...firstTurn.session, turn: { id: "next-turn", sequence: 1 } },
    };

    expect(await sendMessage.execute(message, nextTurn)).toEqual(message);
  });

  it("detects a turn whose latest message is a suppressed delivery", () => {
    expect(endsWithSuppressedDelivery(history(suppressedDeliveryNotice))).toBe(
      true
    );
    expect(
      endsWithSuppressedDelivery(
        history(
          "The message was submitted to the active channel. Do not repeat it in assistant text."
        )
      )
    ).toBe(false);
    expect(
      endsWithSuppressedDelivery([
        ...history(suppressedDeliveryNotice),
        { role: "user", content: "next" },
      ])
    ).toBe(false);
  });
});

async function resolveSendMessage() {
  const tools = await messaging.events["turn.started"]?.({}, linqContext());
  if (!tools || !("send_message" in tools)) {
    throw new Error("send_message was not resolved for an interactive turn.");
  }
  return tools.send_message;
}

function history(toolResult: string): ModelMessage[] {
  return [
    { role: "user", content: "Hi" },
    {
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "send_message",
          input: { kind: "message", text: "hey" },
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "send_message",
          output: { type: "text", value: toolResult },
        },
      ],
    },
  ];
}

function linqContext() {
  return {
    model: null,
    channel: { kind: "channel:linq", metadata: {} },
    messages: [],
    session: {
      auth: {
        current: {
          attributes: { workspaceId: "personal:workspace" },
          authenticator: "linq-message",
          principalId: "user-1",
          principalType: "user",
        },
        initiator: null,
      },
      id: "session-1",
    },
  } satisfies DynamicResolveContext;
}
