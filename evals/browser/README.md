# Browser benchmark

Real-site booking and checkout tasks: movie tickets, restaurants, rail, hotels,
retail. Every task stops before the irreversible step, or before sign-in, a
CAPTCHA or payment. An independent LLM judge grades whether the user's goal was
met. Which tools the agent chose and how it clicked are recorded as diagnostics
only and don't affect pass or fail.

```sh
BROWSER_BENCH_SUITE=smoke pnpm bench:browser          # small subset
BROWSER_BENCH_SUITE=live pnpm bench:browser           # every live task (also: all)
BROWSER_BENCH_REPETITIONS=3 pnpm bench:browser        # repeat runs for timing decisions
pnpm bench:browser --url https://your-deployment      # against a deployment
```

`BROWSER_BENCH_LABEL` tags a run. Each run prints a table of success, duration,
LLM cost and the final message, and writes results to
`.eve/browser-benchmarks/`; `latest.json` is always the newest run. In the cost
column, a `~` means at least one step didn't report its cost.

## Comparing changes

```sh
cp .eve/browser-benchmarks/latest.json .eve/browser-benchmarks/baseline.json
# make your change, then:
pnpm bench:browser
pnpm bench:compare .eve/browser-benchmarks/baseline.json .eve/browser-benchmarks/latest.json
```

Or compare two git refs at once:

```sh
pnpm bench:dashboard   # optional live view at https://eve-browser-bench.localhost
pnpm bench:ab <baseline-ref> <candidate-ref> --suite all --label "what changed"
```

`bench:ab` checks out each ref into a temporary worktree, each with its own
seeded database and server, and runs both at once. It runs 9 tasks per ref at
a time, with a 15-minute limit per task.

| Flag                         | Effect                                     |
| ---------------------------- | ------------------------------------------ |
| `--repetitions <n>`          | Runs each task n times                     |
| `--max-concurrency <n>`      | Changes how many tasks run at once         |
| `--task-timeout-minutes <n>` | Changes the per-task time limit            |
| `--keep`                     | Keeps the worktrees and servers afterwards |

Results go to `.eve/browser-ab/<timestamp>/`.

To add a task, edit `tasks.ts`. Keep tasks few and stable. Give each one the
user's prompt and a rubric that describes success at the goal level.
