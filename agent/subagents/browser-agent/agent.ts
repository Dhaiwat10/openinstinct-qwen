import { defineAgent, defineDynamic } from "eve";
import { resolveModeValue } from "@agent/lib/mode";
import { nearModelIdSelection } from "@agent/lib/near";

// Qwen 3.8 is the verifiable NEAR model that reads screenshots.
const workerModel = nearModelIdSelection("Qwen/Qwen3.8-27B");

export default defineDynamic({
  build: {
    externalDependencies: ["@onkernel/browser-loop"],
  },
  events: {
    "turn.started": (_event, context) => {
      const worker = defineAgent({
        tool: false,
        description:
          "Execute one bounded browser assignment for the root coordinator, including secure vault autofill, transaction preparation, optional durable browser images, human-takeover handoff, cleanup, and a concise verified result.",
        ...workerModel,
        reasoning: "low",
        compaction: {
          thresholdPercent: 0.7,
        },
      });
      return resolveModeValue(context, {
        interactive: worker,
        "scheduled-worker": worker,
      });
    },
  },
});
