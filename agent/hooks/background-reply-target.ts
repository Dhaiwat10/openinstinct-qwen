import { defineHook } from "eve/hooks";
import { registerBackgroundReplyTarget } from "@agent/lib/reply-targets";

export default defineHook({
  events: {
    "task.started"(event, context) {
      if (event.data.name !== "run_browser") return;
      registerBackgroundReplyTarget(event.data.taskId, context.session.auth);
    },
  },
});
