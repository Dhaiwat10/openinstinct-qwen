import { defineAgent, defineDynamic } from "eve";
import { scheduledRunIdentity } from "@agent/lib/schedules/identity";
import { isScheduledAgentRunLeaseActive } from "@db/services/scheduled-agent-run-leases";
import { getModelId } from "@db/services/settings";
import { endsWithSuppressedDelivery } from "@agent/lib/delivery-guard";
import { nearModelSelection } from "@agent/lib/near";
import { scopeFromPrincipal } from "@agent/lib/principal-scope";

export default defineAgent({
  defaultTools: false,
  model: defineDynamic({
    events: {
      "step.started": async (_event, ctx) => {
        const scheduledRun = scheduledRunIdentity(ctx.session.auth);
        if (
          scheduledRun &&
          !(await isScheduledAgentRunLeaseActive(
            scheduledRun.runId,
            scheduledRun.leaseToken
          ))
        ) {
          throw new Error("The scheduled run lease is no longer active.");
        }
        const caller = ctx.session.auth.current ?? ctx.session.auth.initiator;
        if (!caller) throw new Error("An authenticated user is required.");
        if (endsWithSuppressedDelivery(ctx.messages)) {
          throw new Error("Stopped a turn that kept sending messages.");
        }
        // Verifies the Linq replay fix: user messages should not grow within a turn.
        console.info("[turn-shape]", {
          lastRole: ctx.messages.at(-1)?.role,
          messages: ctx.messages.length,
          sessionId: ctx.session.id,
          userMessages: ctx.messages.filter(({ role }) => role === "user")
            .length,
        });
        return nearModelSelection(await getModelId(scopeFromPrincipal(caller)));
      },
    },
  }),
  reasoning: "low",
  compaction: {
    thresholdPercent: 0.7,
  },
});
