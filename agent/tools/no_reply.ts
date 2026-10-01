import { defineDynamic } from "eve/tools";
import { noReply } from "eve/tools/no_reply";
import { resolveModeValue } from "@agent/lib/mode";

const noReplyTool = noReply();

export default defineDynamic({
  events: {
    "turn.started": (_event, context) =>
      resolveModeValue(context, {
        "scheduled-report": { no_reply: noReplyTool },
      }),
  },
});
