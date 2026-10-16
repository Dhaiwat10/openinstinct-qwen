# Evals

There are three tiers:

| Command              | What it checks                                                                                                     | Needs                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `pnpm test:runtime`  | The browser workflow lifecycle (completion, continuation, cancellation), using scripted model replies. Runs in CI. | Nothing                                                                                  |
| `pnpm eval:agent`    | The root agent's behavior: routing, safety, memory, schedules, worker handoff. Lives in `agent/`.                  | Docker, `NEAR_AI_API_KEY`, and `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` for the judge |
| `pnpm bench:browser` | Real-site browser tasks. See [`browser/README.md`](browser/README.md).                                             | Kernel and model keys                                                                    |

```sh
pnpm eval:list                     # list cases without model calls
pnpm eval:agent                    # whole suite; judge thresholds are strict
pnpm eval:agent --tag safety       # one family
pnpm eval:ci                       # JUnit output to .eve/junit.xml
```

`eval:agent` loads `.env.local`, starts an isolated Postgres container, runs the
migrations and then the suite, one case at a time. Kernel and callback URLs
point to an unreachable address, so no case can drive a real browser or leak a
callback. Results go to `.eve/evals/`.

## Writing cases

- Each `.eval.ts` file covers one behavior family.
- Use exact assertions for what you can observe: the tool chosen, a pending
  approval, an absent secret, a delivery. Use the judge only for qualities
  like tone or whether an answer actually helps.
- Turn production failures into small, sanitized cases in the matching family.
- Never write a case that sends, buys, deletes or otherwise changes outside
  state. Approval cases should stop while the action is still pending.
