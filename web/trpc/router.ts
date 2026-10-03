import { revokeToken, startAuthorization } from "@vercel/connect";
import { z } from "zod";
import { listBrowserTraces } from "@db/services/browser-traces";
import { saveChat } from "@db/services/chats";
import { replaceUserProfile } from "@db/services/user-profile";
import { selectModelId } from "@db/services/settings";
import { deleteVaultItem, saveVaultItem } from "@db/services/vault";
import type { AccessScope } from "@shared/identity/access-scope";
import { saveChatSchema } from "@shared/chat/schema";
import { env } from "@shared/environment";
import { nearApiBaseUrl, verifiableModels } from "@shared/inference/models";
import {
  googleWorkspaceSubject,
  googleWorkspaceTokenParams,
} from "@shared/google-workspace/connection";
import { userProfileSchema } from "@shared/user-profile/schema";
import {
  vaultCreateItemSchema,
  vaultImportItemsSchema,
} from "@shared/vault/schema";
import { createTRPCRouter, protectedProcedure } from "./init";

export const appRouter = createTRPCRouter({
  chats: {
    save: protectedProcedure
      .input(saveChatSchema)
      .mutation(({ ctx, input }) => saveChat(ctx.scope, input)),
  },
  googleWorkspace: {
    update: protectedProcedure
      .input(z.enum(["connect", "disconnect"]))
      .mutation(async ({ ctx, input }) => {
        if (input === "disconnect") {
          await revokeToken(env.GOOGLE_CONNECTOR_UID, {
            subject: googleWorkspaceSubject(ctx.scope.userId),
          });
          return { redirectTo: "/?google=disconnected" };
        }

        const callbackUrl = new URL("/", ctx.origin);
        callbackUrl.searchParams.set("google", "connected");
        return {
          redirectTo: await startGoogleWorkspaceAuthorization(
            ctx.scope,
            callbackUrl.toString()
          ),
        };
      }),
  },
  settings: {
    selectModel: protectedProcedure
      .input(
        z.object({
          modelId: z.enum(verifiableModels.map((model) => model.id)),
        })
      )
      .mutation(({ ctx, input }) => selectModelId(ctx.scope, input.modelId)),
  },
  userProfile: {
    update: protectedProcedure
      .input(userProfileSchema)
      .output(userProfileSchema)
      .mutation(({ ctx, input }) => replaceUserProfile(ctx.scope, input)),
  },
  traces: {
    list: protectedProcedure
      .input(z.object({ cursor: z.string().nullish() }))
      .query(({ ctx, input }) =>
        listBrowserTraces(ctx.scope, input.cursor ?? undefined)
      ),
  },
  vault: {
    create: protectedProcedure
      .input(vaultCreateItemSchema)
      .mutation(({ ctx, input }) => saveVaultItem(ctx.scope, input)),
    import: protectedProcedure
      .input(vaultImportItemsSchema)
      .mutation(async ({ ctx, input }) => {
        /* oxlint-disable eslint/no-await-in-loop -- Import preserves source order and avoids concurrent writes to the same vault scope. */
        for (const item of input) await saveVaultItem(ctx.scope, item);
        /* oxlint-enable eslint/no-await-in-loop */
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(({ ctx, input }) => deleteVaultItem(ctx.scope, input.id)),
  },
  models: {
    list: protectedProcedure.query(readModelCatalog),
  },
});

export type AppRouter = typeof appRouter;

async function startGoogleWorkspaceAuthorization(
  scope: AccessScope,
  callbackUrl: string
) {
  const authorization = await startAuthorization(
    env.GOOGLE_CONNECTOR_UID,
    googleWorkspaceTokenParams(scope.userId),
    { callbackUrl, expiresInMs: 10 * 60_000 }
  );
  return authorization.url;
}

const nearModelCatalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      pricing: z
        .object({
          input: z.number().nonnegative(),
          output: z.number().nonnegative(),
        })
        .optional(),
    })
  ),
});

// NEAR prices are already per million tokens.
async function readModelCatalog() {
  const response = await fetch(`${nearApiBaseUrl}/models`, {
    headers: { authorization: `Bearer ${env.NEAR_AI_API_KEY}` },
  });
  if (!response.ok) {
    throw new Error(
      `NEAR AI model list failed with HTTP ${String(response.status)}.`
    );
  }
  const { data } = nearModelCatalogSchema.parse(await response.json());

  return verifiableModels.flatMap(({ id }) => {
    const model = data.find((candidate) => candidate.id === id);
    if (!model) return [];
    return [
      {
        id,
        name: model.name,
        ownedBy: id.split("/", 1)[0]?.toLowerCase() ?? "nearai",
        pricing: model.pricing,
      },
    ];
  });
}
