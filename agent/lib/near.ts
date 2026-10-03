import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@shared/environment";
import { nearApiBaseUrl, verifiableModel } from "@shared/inference/models";

const near = createOpenAICompatible({
  name: "near",
  baseURL: nearApiBaseUrl,
  apiKey: env.NEAR_AI_API_KEY,
  includeUsage: true,
});

// Eve persists runtime-selected subagent models as string ids and hands them to
// the AI SDK, which resolves strings through this provider instead of AI Gateway.
globalThis.AI_SDK_DEFAULT_PROVIDER = near;

export function nearModelIdSelection(modelId: string | undefined) {
  const model = verifiableModel(modelId);
  return {
    model: model.id,
    modelContextWindowTokens: model.contextWindowTokens,
  };
}

export function nearModelSelection(modelId: string | undefined) {
  const model = verifiableModel(modelId);
  return {
    model: near.chatModel(model.id),
    modelContextWindowTokens: model.contextWindowTokens,
  };
}
