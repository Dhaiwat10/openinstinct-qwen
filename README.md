<div align="center">

<img src=".github/logo.png" alt="OpenInstinct" width="420">

**A self-hosted iMessage assistant that can use a browser for you.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDhaiwat10%2Fopeninstinct-qwen&project-name=openinstinct-qwen&repository-name=openinstinct-qwen&env=NEAR_AI_API_KEY%2CALLOWED_PHONE_NUMBERS&envDescription=NEAR%20AI%20Cloud%20API%20key%20for%20inference%2C%20and%20the%20E.164%20phone%20numbers%20allowed%20to%20use%20the%20assistant%20%28comma-separated%29.&envLink=https%3A%2F%2Fgithub.com%2FDhaiwat10%2Fopeninstinct-qwen%23environment-variables&connect=%5B%7B%22type%22%3A%22linq%22%2C%22env%22%3A%22LINQ_CONNECTOR%22%2C%22triggers%22%3Atrue%2C%22triggerPath%22%3A%22%2Feve%2Fv1%2Flinq%22%7D%5D&stores=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22other%22%2C%22productSlug%22%3A%22kernel%22%2C%22integrationSlug%22%3A%22kernel%22%7D%2C%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%2C%7B%22type%22%3A%22blob%22%2C%22access%22%3A%22private%22%7D%5D)

<img src=".github/demo.png" alt="OpenInstinct booking movie tickets over iMessage — it walks Fandango to checkout and reports the theater, showtime, seat, and total" width="640">

</div>

You text it and it does the task: booking tickets, checking your calendar,
filling in forms. Passwords and cards stay encrypted in your own database, and
the model never sees them.

This is a fork of
[Merit-Systems/OpenInstinct](https://github.com/Merit-Systems/OpenInstinct). It
differs from upstream in a few ways:

- **Inference runs on Qwen through [NEAR AI Cloud](https://cloud.near.ai)**, in
  TEEs that publish attestation evidence, instead of Vercel AI Gateway. Both the
  agent and the browser worker default to `Qwen/Qwen3.8-27B`; the alternatives
  are listed in `shared/inference/models.ts`.
- **Web search uses [Tavily](https://tavily.com).** Queries leave the TEE.
- **`ALLOWED_PHONE_NUMBERS` makes a deployment private** (see below).
- **Google access is read-only.** The agent can read Gmail, Calendar and
  Contacts, but it can't send mail or create events.
- **Fits the Vercel Hobby plan.** Scheduled tasks run once a day at 13:00 UTC.
- **Fixes for Qwen over iMessage:** the date is stated on every turn, a turn
  never ends without a reply, and a turn can't answer its own message again.

## Deploy

1. Click **Deploy with Vercel** above. It provisions Kernel (cloud browsers),
   Neon (Postgres), a private Blob store and a Linq iMessage line, then asks for
   two values:
   - `NEAR_AI_API_KEY` from [cloud.near.ai](https://cloud.near.ai).
   - `ALLOWED_PHONE_NUMBERS`: your number in E.164 format, such as
     `+14155550123`. Separate multiple numbers with commas.
2. Optional: add `TAVILY_API_KEY` from [app.tavily.com](https://app.tavily.com)
   to turn on web search.
3. In the Linq connector's Vercel Connect settings, complete the one-time
   **Phone Numbers** verification. Then text the Linq number once and sign in
   at your deployment URL with your phone number.

Auth and vault-encryption keys are generated in the Blob store on first use.
**Don't delete that store**: it holds the only copy of the vault key.

### Environment variables

| Variable                                                         | Required        | Notes                                                                                           |
| ---------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `NEAR_AI_API_KEY`                                                | Yes             | Model inference.                                                                                |
| `ALLOWED_PHONE_NUMBERS`                                          | Recommended     | Comma-separated E.164 numbers. If unset, any verified phone can sign up and spend your credits. |
| `TAVILY_API_KEY`                                                 | No              | Enables `web_search`.                                                                           |
| `KERNEL_API_KEY`                                                 | Auto            | Set by the Kernel integration. Needed manually outside Vercel.                                  |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`                          | Auto            | Set by Neon.                                                                                    |
| `LINQ_CONNECTOR`                                                 | Auto            | Set by the deploy flow. See [Linq](#linq-imessage).                                             |
| `GOOGLE_CONNECTOR_UID`                                           | No              | Defaults to `google/open-instinct`. See [Google](#google-gmail-calendar-contacts).              |
| `LINK_CLIENT_ID`, `LINK_CLIENT_SECRET`, `STRIPE_PUBLISHABLE_KEY` | No              | Stripe Link wallet. See [Link](#link-wallet).                                                   |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SECRET_ENCRYPTION_KEY` | Non-Vercel only | Generate the secrets with `openssl rand -base64 32`.                                            |
| `BLOB_READ_WRITE_TOKEN`                                          | Non-Vercel only | Private Blob store for memory and browser images.                                               |

Keep `ALLOWED_PHONE_NUMBERS` in the deployment environment, not in source, so a
public fork doesn't publish your number.

## Linq (iMessage)

The deploy button sets this up for you. To add it to an existing Vercel project:

```bash
vercel link
vercel connect create linq --connection-method line --name open-instinct --triggers --trigger-event message.received --trigger-event reaction.added --trigger-event reaction.removed --trigger-path /eve/v1/linq --trigger-project <project> --json
vercel connect attach <connector-uid> --project <project> --environment production --triggers --trigger-path /eve/v1/linq --yes
vercel env add LINQ_CONNECTOR production --value <connector-uid> --yes
```

Then redeploy. Pass the `--triggers` flags on both commands. A connector
created without them can send sign-in codes but never forwards incoming texts,
and you can't turn triggers on later.

## Google (Gmail, Calendar, Contacts)

The app requests read-only scopes: `gmail.readonly`,
`calendar.events.readonly`, `calendar.freebusy` and `contacts.readonly`.

1. In [Google Cloud Console](https://console.cloud.google.com/projectcreate),
   create a project and enable the **Gmail**, **Calendar** and **People** APIs.
2. Configure the [OAuth consent screen](https://console.cloud.google.com/auth/overview)
   as External, and add your Gmail address under **Audience → Test users**.
   Without that, Google rejects the connection with `Error 403: access_denied`.
3. [Create an OAuth client](https://console.cloud.google.com/auth/clients/create)
   of type Web application, with the redirect URI
   `https://connect.vercel.com/callback`. Download the JSON.
4. Create and attach the connector:

   ```bash
   f="$(mktemp)"
   jq '{clientId: .web.client_id, clientSecret: .web.client_secret}' ~/Downloads/client_secret_*.json > "$f"
   vercel connect create google --connection-method oauth --name open-instinct --data @"$f"
   rm -f "$f"
   vercel connect attach google/open-instinct --project <project> --environment production --yes
   ```

5. Redeploy, sign in to the web app, and click **Connect** on the Google
   Workspace card.

If you connected before the scopes changed, click Disconnect, then Connect, to
replace the old grant. While the app is in Testing mode, the grant expires
every 7 days. When it does,
click Disconnect, then Connect. A connector only works in the Vercel
environments it's attached to.

## Link wallet

Optional. This lets the agent pay with your [Stripe Link](https://link.com)
wallet. Every purchase still needs your approval in Link.

1. Register a Link OAuth client with the redirect URI
   `https://<your-host>/api/auth/callback/link`.
2. Set `LINK_CLIENT_ID`, `LINK_CLIENT_SECRET`, `STRIPE_PUBLISHABLE_KEY` and
   `BETTER_AUTH_URL`.
3. Connect the wallet from **Link wallet** in the sidebar.

## Local development

You need Node 24, pnpm 11.24.0, Docker, a Kernel API key and a NEAR AI API key.

```bash
git clone https://github.com/Dhaiwat10/openinstinct-qwen.git
cd openinstinct-qwen
pnpm install --frozen-lockfile
cp .env.example .env.local   # set KERNEL_API_KEY, NEAR_AI_API_KEY, optionally TAVILY_API_KEY
pnpm dev
```

`pnpm dev` starts Postgres in Docker, runs the migrations and starts the app.
Use `pnpm dev:app` to run against your own database instead.

| Command                           | What it does                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm check`                      | Runs lint, type checks, tests, the format check and knip                           |
| `pnpm build`                      | Builds for production (needs the env vars above)                                   |
| `pnpm db:generate` / `db:migrate` | Generates or applies migrations ([`db/`](db/README.md))                            |
| `pnpm eval:agent`                 | Runs the agent behavior evals ([`evals/`](evals/README.md))                        |
| `pnpm bench:browser`              | Runs the real-site browser benchmark ([`evals/browser/`](evals/browser/README.md)) |

On Vercel Pro, you can change the cron in `agent/schedules/dynamic.ts` back to
`* * * * *` so scheduled tasks run every minute instead of once a day.

> [!WARNING]
> Experimental. This isn't production software.

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
