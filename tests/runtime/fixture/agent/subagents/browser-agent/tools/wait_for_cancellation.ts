import { defineTool } from "eve/tools";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";

export default defineTool({
  description: "Hold an active fixture tool until the parent cancels it.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    await setTimeout(60_000, undefined, { signal: ctx.abortSignal });
    throw new Error("Fixture work was not cancelled before its deadline.");
  },
});
