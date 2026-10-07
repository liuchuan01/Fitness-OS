import { getJson, putJson } from "./http";
import {
  modelPreferencesResponseSchema,
  type ModelSelection
} from "../../shared/dsh-model-preferences";
export type { ModelSelection, ModelPreferences } from "../../shared/dsh-model-preferences";

export async function getModelPreferences(signal?: AbortSignal) {
  return (
    await getJson("/api/model/preferences", modelPreferencesResponseSchema, {
      signal,
      timeoutMs: 25000
    })
  ).preferences;
}
export async function saveModelPreferences(selection: ModelSelection, revision: number) {
  return (
    await putJson(
      "/api/model/preferences",
      { ...selection, revision },
      modelPreferencesResponseSchema
    )
  ).preferences;
}
