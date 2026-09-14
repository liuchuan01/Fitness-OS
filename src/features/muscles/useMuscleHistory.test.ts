import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getMuscleHistory } from "../../api/muscle-history";
import { buildMuscleHistory } from "../../../shared/fitness/muscle-history";
import type { MuscleId } from "../../../shared/muscle-taxonomy";
import { useMuscleHistory } from "./useMuscleHistory";

vi.mock("../../api/muscle-history", () => ({ getMuscleHistory: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const data = (muscleId: MuscleId) =>
  buildMuscleHistory({ muscleId, date: "2026-06-20", workouts: [], muscleMap: {} });

it("cancels old selections, ignores late responses and reloads after a validated revision", async () => {
  let finishOld!: (value: ReturnType<typeof data>) => void;
  vi.mocked(getMuscleHistory)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        })
    )
    .mockResolvedValue(data("pec_major_mid"));
  const { result, rerender } = renderHook(
    ({ id, revision }: { id: MuscleId; revision: number }) =>
      useMuscleHistory(id, "2026-06-20", revision),
    {
      initialProps: { id: "latissimus_dorsi", revision: 0 }
    }
  );
  const oldSignal = vi.mocked(getMuscleHistory).mock.calls[0][2];
  rerender({ id: "pec_major_mid", revision: 0 });
  expect(oldSignal.aborted).toBe(true);
  await waitFor(() =>
    expect(result.current.state).toMatchObject({
      status: "ready",
      data: { muscleId: "pec_major_mid" }
    })
  );
  await act(async () => finishOld(data("latissimus_dorsi")));
  expect(result.current.state).toMatchObject({
    status: "ready",
    data: { muscleId: "pec_major_mid" }
  });
  rerender({ id: "pec_major_mid", revision: 1 });
  await waitFor(() => expect(getMuscleHistory).toHaveBeenCalledTimes(3));
});

it("reports failures and retries without manufacturing an empty history", async () => {
  vi.mocked(getMuscleHistory)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(data("latissimus_dorsi"));
  const { result } = renderHook(() => useMuscleHistory("latissimus_dorsi", "2026-06-20", 0));
  await waitFor(() => expect(result.current.state.status).toBe("error"));
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.state.status).toBe("ready"));
});
