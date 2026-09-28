# Eve and Linq compatibility patches

Eve is pinned to the published `0.67.2` release.

`@linqapp__chat-sdk-adapter@0.5.1.patch` adds the native reply option to
the separately installed adapter while preserving attachments and idempotency.
The application delivery tests exercise that adapter.

`eve@0.67.2.patch` preserves native Linq replies and restores task cancellation:

- The bundled Linq adapter forwards `replyToMessageId` as `reply_to` and uses
  the installed adapter declarations. The provider-request regression lives in
  `tests/agent/channels/linq-bundled-adapter.test.ts`.
- Eve registers an explicitly restored `task_cancel` as an authored tool. Its
  runtime only assigns cancellation dispatch to framework-owned tools, leaving
  the restored tool advertised but without an executor. Recognize the reserved
  `task_cancel` name in that existing dispatch path, as Eve's built-in-tool docs
  specify that its framework behavior cannot be overridden. Keep all other
  authored tools on their existing path.

`pnpm test:runtime` exercises the production tool declarations with
`defaultTools: false`, waits for child work to start, cancels it, and checks the
child's cancellation event. Remove each patch hunk when an upstream release
passes its corresponding regression without the hunk.
