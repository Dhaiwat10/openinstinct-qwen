import { and, eq } from "drizzle-orm";
import type { AccessScope } from "@shared/identity/access-scope";
import {
  type VerifiableModelId,
  verifiableModel,
} from "@shared/inference/models";
import { db, settings } from "@db";

// The stored key predates NEAR AI inference; renaming it needs a migration.
const modelKey = "gateway_model";

async function readModelId(scope: AccessScope) {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(
      and(
        eq(settings.workspaceId, scope.workspaceId),
        eq(settings.key, modelKey)
      )
    )
    .limit(1);
  return rows[0]?.value;
}

// Ids saved before the NEAR switch, such as AI Gateway ids, fall back to the default.
export async function getModelId(scope: AccessScope) {
  return verifiableModel(await readModelId(scope)).id;
}

export async function selectModelId(
  scope: AccessScope,
  modelId: VerifiableModelId
) {
  await db
    .insert(settings)
    .values({
      key: modelKey,
      value: modelId,
      workspaceId: scope.workspaceId,
    })
    .onConflictDoUpdate({
      target: [settings.workspaceId, settings.key],
      set: { value: modelId },
    });
}
