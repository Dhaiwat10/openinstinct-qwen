import { z } from "zod";
import { getLinkAccount, linkConfigured } from "@db/services/auth/link";
import { requireRequestScope } from "@web/auth/request-scope";
import { Button } from "@web/components/ui/button";

export const metadata = {
  title: "Link wallet",
  referrer: "no-referrer" as const,
};

export default async function Page({ searchParams }: PageProps<"/link">) {
  const scope = await requireRequestScope();
  const params = await searchParams;
  const attempt = z.uuid().safeParse(params.attempt);
  const configured = linkConfigured();
  const connected =
    configured &&
    Boolean(await getLinkAccount(scope.userId.slice("better-auth:".length)));
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="type-page-title">Link wallet</h1>
        <p className="type-body text-muted-foreground">
          {configured
            ? connected
              ? "Your Link wallet is connected. Purchases still require approval in Link."
              : "Connect your Link wallet to use it with OpenInstinct. Purchases require your approval in Link."
            : "Link is not available on this installation yet."}
        </p>
      </div>
      {params.error && (
        <p role="alert" className="type-supporting text-destructive">
          The wallet connection could not be completed. Try again, or sign in
          again before disconnecting. To use a different wallet, disconnect the
          current wallet first.
        </p>
      )}
      {configured && (
        <div className="flex flex-wrap gap-3">
          {(!connected || attempt.success) && (
            <form action="/api/link" method="post">
              <input type="hidden" name="operation" value="connect" />
              {attempt.success && (
                <input type="hidden" name="attempt" value={attempt.data} />
              )}
              <Button type="submit">
                {connected ? "Reconnect Link and continue" : "Connect Link"}
              </Button>
            </form>
          )}
          {connected && (
            <form action="/api/link" method="post">
              <input type="hidden" name="operation" value="disconnect" />
              <Button type="submit" variant="outline">
                Disconnect wallet
              </Button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
