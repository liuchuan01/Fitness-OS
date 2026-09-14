import { useEffect, useState } from "react";
import { getMuscleHistory } from "../../api/muscle-history";
import type { MuscleHistory } from "../../../shared/fitness/muscle-history-schema";
import type { MuscleId } from "../../../shared/muscle-taxonomy";

type HistoryState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: MuscleHistory };

export function useMuscleHistory(
  muscleId: MuscleId | null,
  date: string | undefined,
  revision: number
) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; state: HistoryState } | null>(null);
  const key = `${muscleId}:${date}:${revision}:${retry}`;
  useEffect(() => {
    if (!muscleId || !date) return;
    const controller = new AbortController();
    getMuscleHistory(muscleId, date, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, state: { status: "ready", data } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key, state: { status: "error" } });
      });
    return () => controller.abort();
  }, [muscleId, date, key]);
  const state: HistoryState = result?.key === key ? result.state : { status: "loading" };
  return { state, retry: () => setRetry((value) => value + 1) };
}
