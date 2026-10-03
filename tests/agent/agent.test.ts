import type { DynamicResolveContext } from "eve";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { isScheduledAgentRunLeaseActive } from "@db/services/scheduled-agent-run-leases";
import type { getModelId } from "@db/services/settings";

const services = vi.hoisted(() => ({
  getModel: vi.fn<typeof getModelId>(),
  isActive: vi.fn<typeof isScheduledAgentRunLeaseActive>(),
}));

vi.mock("@db/services/scheduled-agent-run-leases", () => ({
  isScheduledAgentRunLeaseActive: services.isActive,
}));
vi.mock("@db/services/settings", () => ({
  getModelId: services.getModel,
}));

import agent from "@agent/agent";

const runId = "00000000-0000-4000-8000-000000000001";
const oldLeaseToken = "00000000-0000-4000-8000-000000000002";
const retryLeaseToken = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  services.getModel.mockResolvedValue("Qwen/Qwen3.6-35B-A3B-FP8");
});

describe("root agent model resolution", () => {
  it("accepts a valid retry lease forwarded into an older Eve session", async () => {
    services.isActive.mockImplementation(async (_runId, leaseToken) => {
      return leaseToken === retryLeaseToken;
    });

    const model = await agent.model.events["step.started"]?.(
      {},
      scheduledWorkerContext()
    );

    expect(services.isActive).toHaveBeenCalledExactlyOnceWith(
      runId,
      retryLeaseToken
    );
    expect(services.getModel).toHaveBeenCalledExactlyOnceWith({
      userId: "user-1",
      workspaceId: "workspace-1",
    });
    expect(model).toMatchObject({
      model: { modelId: "Qwen/Qwen3.6-35B-A3B-FP8", provider: "near.chat" },
      modelContextWindowTokens: 262_144,
    });
  });

  it("rejects a scheduled worker after its lease is replaced", async () => {
    services.isActive.mockResolvedValue(false);

    await expect(
      agent.model.events["step.started"]?.({}, scheduledWorkerContext())
    ).rejects.toThrow("The scheduled run lease is no longer active.");
    expect(services.getModel).not.toHaveBeenCalled();
  });
});

function scheduledWorkerContext(): DynamicResolveContext {
  return {
    model: null,
    channel: { kind: "http" },
    messages: [],
    session: {
      auth: {
        current: {
          attributes: {
            scheduledRunId: runId,
            scheduledRunLeaseToken: retryLeaseToken,
            workspaceId: "workspace-1",
          },
          authenticator: "scheduled-worker",
          principalId: "user-1",
          principalType: "user",
        },
        initiator: {
          attributes: {
            scheduledRunId: runId,
            scheduledRunLeaseToken: oldLeaseToken,
            workspaceId: "workspace-1",
          },
          authenticator: "scheduled-worker",
          principalId: "user-1",
          principalType: "user",
        },
      },
      id: "worker-session",
    },
  };
}
