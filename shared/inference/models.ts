export const nearApiBaseUrl = "https://cloud-api.near.ai/v1";

// NEAR AI Cloud models served from TEEs with tool calling, default first. NEAR's
// model list does not mark TEE hosting, so keep this in step with
// https://near.ai/models.
export const verifiableModels = [
  { id: "Qwen/Qwen3.8-27B", contextWindowTokens: 262_144 },
  { id: "Qwen/Qwen3.6-35B-A3B-FP8", contextWindowTokens: 262_144 },
] as const;

export type VerifiableModelId = (typeof verifiableModels)[number]["id"];

export function verifiableModel(modelId: string | undefined) {
  return (
    verifiableModels.find((model) => model.id === modelId) ??
    verifiableModels[0]
  );
}
