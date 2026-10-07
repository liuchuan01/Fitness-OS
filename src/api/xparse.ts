import { getJson, putJson } from "./http";
import {
  xparseCredentialsResponseSchema,
  xparseSettingsResponseSchema,
  type XparseSettings
} from "../../shared/xparse";
export type { XparseSettings, XparseCredentials } from "../../shared/xparse";

export async function getXparseSettings(signal?: AbortSignal) {
  return (await getJson("/api/xparse/settings", xparseSettingsResponseSchema, { signal })).settings;
}
export async function saveXparseSettings(settings: XparseSettings) {
  return (await putJson("/api/xparse/settings", settings, xparseSettingsResponseSchema)).settings;
}
export async function getXparseCredentials(signal?: AbortSignal) {
  return (await getJson("/api/xparse/credentials", xparseCredentialsResponseSchema, { signal }))
    .credentials;
}
export async function saveXparseCredentials(
  input: { appId: string; secretCode: string } | { clear: true }
) {
  return (await putJson("/api/xparse/credentials", input, xparseCredentialsResponseSchema))
    .credentials;
}
