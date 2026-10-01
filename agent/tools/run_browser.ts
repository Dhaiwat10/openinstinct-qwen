import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { taskCompletionSchema } from "@agent/subagents/browser-agent/lib/completion";

export default defineWorkflowTool({
  description:
    "Execute one bounded browser assignment and return a verified result with optional private image artifacts. Continue the same worker using its taskId. The completion schema is supplied automatically.",
  inputSchema: z.object({ message: z.string().min(1) }),
  async serve(receive, ctx) {
    "use workflow";
    const worker = ctx.agent("browser-agent");
    /* oxlint-disable eslint/no-await-in-loop -- A resumable task serves sequential calls on one child session. */
    for (;;) {
      const { input, abortSignal } = await receive();
      try {
        const response = await worker.send(input.message, {
          outputSchema: taskCompletionSchema,
          signal: abortSignal,
        });
        const result = await response.result();
        if (abortSignal.aborted) continue;
        if (result.status === "failed") {
          throw new Error(
            result.error?.message ?? "The browser worker failed."
          );
        }
        ctx.reply(taskCompletionSchema.parse(result.data));
      } catch (error) {
        if (!abortSignal.aborted) throw error;
      }
    }
    /* oxlint-enable eslint/no-await-in-loop */
  },
});
