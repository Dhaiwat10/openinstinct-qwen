import { defineHook } from "eve/hooks";
import { registerBackgroundReplyTarget } from "@agent/lib/reply-targets";
import { z } from "zod";

const taskReceiptSchema = z.object({
  status: z.literal("working"),
  taskId: z.string().min(1),
});

export default defineHook({
  events: {
    "action.result"(event, context) {
      const result = event.data.result;
      if (
        event.data.status !== "completed" ||
        result.kind !== "tool-result" ||
        result.toolName !== "run_browser"
      )
        return;
      const task = taskReceiptSchema.safeParse(result.output);
      if (!task.success) return;
      registerBackgroundReplyTarget(task.data.taskId, context.session.auth);
    },
  },
});
