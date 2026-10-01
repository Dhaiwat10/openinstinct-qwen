import type { AgentSession, WorkflowToolContext } from "eve/tools";
import { describe, expect, it, vi } from "vitest";
import runBrowser from "@agent/tools/run_browser";
import { taskCompletionSchema } from "@agent/subagents/browser-agent/lib/completion";
import { toolContextFor } from "@tests/helpers/tool-context";

const completion = {
  status: "success",
  message: "Verified the page heading.",
  images: [],
};

describe("structured browser workflow", () => {
  it("reuses one child session and requests structured output for every continuation", async () => {
    const send = vi.fn<AgentSession["send"]>().mockResolvedValue({
      result: async () => ({
        data: completion,
        status: "waiting",
        message: undefined,
      }),
    });
    // SAFETY: This fixture only sends the fixed taskCompletionSchema and returns its corresponding output.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Vitest erases the generic send result; this fixture exercises only the production completion schema.
    const worker = { send } as AgentSession;
    const agent = vi.fn<WorkflowToolContext["agent"]>().mockReturnValue(worker);
    const receive = vi
      .fn<Parameters<typeof runBrowser.serve>[0]>()
      .mockResolvedValueOnce({
        input: { message: "Inspect the heading" },
        callId: "first",
        abortSignal: new AbortController().signal,
      })
      .mockResolvedValueOnce({
        input: { message: "Inspect the footer" },
        callId: "next",
        abortSignal: new AbortController().signal,
      })
      .mockRejectedValue(new Error("fixture finished"));
    const reply = vi.fn<Parameters<typeof runBrowser.serve>[1]["reply"]>();
    await expect(
      runBrowser.serve(receive, {
        ...toolContextFor(),
        agent,
        agents: {},
        ask: vi.fn<WorkflowToolContext["ask"]>(),
        reply,
      })
    ).rejects.toThrow("fixture finished");
    expect(agent).toHaveBeenCalledExactlyOnceWith("browser-agent");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toBe("Inspect the heading");
    expect(send.mock.calls[0]?.[1]?.outputSchema).toBe(taskCompletionSchema);
    expect(send.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(send.mock.calls[1]?.[0]).toBe("Inspect the footer");
    expect(reply).toHaveBeenCalledTimes(2);
    expect(reply).toHaveBeenLastCalledWith(completion);
  });

  it("rejects malformed completion instead of reporting success", async () => {
    const send = vi.fn<AgentSession["send"]>().mockResolvedValue({
      result: async () => ({
        data: { status: "success", message: "Done" },
        status: "waiting",
        message: undefined,
      }),
    });
    // SAFETY: This fixture deliberately returns invalid data to exercise runtime output validation.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Vitest erases the generic send result; this fixture exercises only the production completion schema.
    const worker = { send } as AgentSession;
    const receive = vi
      .fn<Parameters<typeof runBrowser.serve>[0]>()
      .mockResolvedValue({
        input: { message: "Inspect the heading" },
        callId: "first",
        abortSignal: new AbortController().signal,
      });
    const reply = vi.fn<Parameters<typeof runBrowser.serve>[1]["reply"]>();
    await expect(
      runBrowser.serve(receive, {
        ...toolContextFor(),
        agent: () => worker,
        agents: {},
        ask: vi.fn<WorkflowToolContext["ask"]>(),
        reply,
      })
    ).rejects.toThrow(/images/u);
    expect(reply).not.toHaveBeenCalled();
  });
});
