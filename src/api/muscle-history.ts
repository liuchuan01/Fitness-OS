import { muscleHistoryResponseSchema } from "../../shared/fitness/muscle-history-schema";
import type { MuscleId } from "../../shared/muscle-taxonomy";
import { getJson } from "./http";

export async function getMuscleHistory(muscleId: MuscleId, date: string, signal: AbortSignal) {
  const query = new URLSearchParams({ date });
  return (
    await getJson(`/api/muscles/${muscleId}?${query}`, muscleHistoryResponseSchema, { signal })
  ).muscle;
}
