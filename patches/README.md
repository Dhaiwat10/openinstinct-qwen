# Dependency compatibility patches

Eve is pinned to the published `0.69.0` release.

`@linqapp__chat-sdk-adapter@0.5.1.patch` adds the native reply option to
the separately installed adapter while preserving attachments and idempotency.
The application delivery tests exercise that adapter.

`eve@0.69.0.patch` preserves native Linq replies. The bundled adapter forwards
`replyToMessageId` as `reply_to` and uses the installed adapter declarations.
The provider-request regression lives in
`tests/agent/channels/linq-bundled-adapter.test.ts`.

Eve 0.69 owns task cancellation for every task, including with `defaultTools:
false`. The old cancellation patch and authored `task_cancel` declaration are
removed.

`pnpm test:runtime` exercises the production tool declarations with
`defaultTools: false`, waits for child work to start, cancels it, checks its abort signal,
and resumes the same child session. Remove each patch hunk when an upstream release
passes its corresponding regression without the hunk.

`@stripe__link-integrations-eve@0.2.0.patch` contains the generated output of
rebuilding Stripe's official extension source with Eve `0.69.0`. The published
package was built with `0.54.4` and requires tool contract v36, which `0.69.0`
rejects. The compiler emits tool contract v71 and skill contract v2 when it
rebuilds this source. The resulting JavaScript and skills are byte-for-byte
identical to the published package; only generated compatibility metadata and
declaration ordering differ. This is a compiler rebuild, not a manual override
of Eve's compatibility check.

Source: `stripe/link-cli` commit
`1790c0fa1cc6549f325c74b4af57b06272d5309a` (the 0.2.0 release), directory
`packages/integrations/eve/extension`. To reproduce, copy the published package
to a temporary directory, add that exact upstream `extension/` source, resolve
its dependencies against this application's installed packages, and run
`node <app>/node_modules/eve/bin/eve.js extension build` from the temporary
directory. Replace the patch package's `dist/` with that output and run
`pnpm patch-commit <patch-directory>`.

Remove this patch when a published Stripe extension builds on the pinned Eve
version without it. `pnpm exec eve build --skip-sandbox-prewarm` validates
extension discovery and compilation without requiring a local sandbox daemon.
