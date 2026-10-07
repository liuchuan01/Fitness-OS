import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboard, getTodayPlan, getWorkout, getWorkouts } from "../../api/client";
import type { DailyWorkout, DashboardResponse, TimelineWorkout, TodayPlan } from "../../api/client";

import { subscribeDataChanges } from "../../api/data-sync";

type Dashboard = DashboardResponse["projection"];

export function useDashboardData() {
  const [dataSyncStatus, setDataSyncStatus] = useState<"connected" | "disconnected" | "invalid">(
    "connected"
  );
  const [dataSyncError, setDataSyncError] = useState<string | null>(null);
  const selectedDate = useRef<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dailyWorkout, setDailyWorkout] = useState<DailyWorkout | null>(null);
  const [focusedPlan, setFocusedPlan] = useState<TodayPlan | null>(null);
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [isDailyWorkoutLoading, setIsDailyWorkoutLoading] = useState(false);
  const [isServiceOffline, setIsServiceOffline] = useState(false);
  const [search, setSearch] = useState("");
  const [timeline, setTimeline] = useState<TimelineWorkout[]>([]);
  const workoutRequest = useRef<AbortController | null>(null);

  useEffect(
    () =>
      subscribeDataChanges(
        (event) => {
          if (event.type === "fitness.data-invalid") {
            setDataSyncStatus("invalid");
            setDataSyncError(event.message ?? null);
            return;
          }
          setDataSyncStatus("connected");
          setDataSyncError(null);
          setRefreshVersion((version) => version + 1);
        },
        () => setDataSyncStatus("disconnected")
      ),
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    getDashboard({ signal: controller.signal })
      .then((response) => {
        setDashboard(response.projection);
        setIsServiceOffline(false);
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) setIsServiceOffline(true);
      });

    return () => controller.abort();
  }, [refreshVersion]);

  useEffect(() => {
    if (!dashboard?.date) return;

    const controller = new AbortController();
    getTodayPlan(dashboard.date, { signal: controller.signal })
      .then(setTodayPlan)
      .catch((error: unknown) => {
        if (!isAbortError(error)) setTodayPlan(null);
      });

    return () => controller.abort();
  }, [dashboard?.date, refreshVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getWorkouts(search, { signal: controller.signal })
        .then(setTimeline)
        .catch((error: unknown) => {
          if (!isAbortError(error)) setTimeline([]);
        });
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, refreshVersion]);

  useEffect(
    () => () => {
      workoutRequest.current?.abort();
    },
    []
  );

  const loadWorkout = useCallback(async (date: string) => {
    const isNewDate = selectedDate.current !== date;
    selectedDate.current = date;
    workoutRequest.current?.abort();
    const controller = new AbortController();
    workoutRequest.current = controller;
    setIsDailyWorkoutLoading(true);
    if (isNewDate) setDailyWorkout(null);

    try {
      const workout = await getWorkout(date, { signal: controller.signal });
      if (controller.signal.aborted) return null;
      setDailyWorkout(workout);
      setIsServiceOffline(false);
      return workout;
    } catch (error) {
      if (!isAbortError(error)) setIsServiceOffline(true);
      return null;
    } finally {
      if (workoutRequest.current === controller) {
        setIsDailyWorkoutLoading(false);
        workoutRequest.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (selectedDate.current)
      void loadWorkout(selectedDate.current).catch(() => setIsServiceOffline(true));
  }, [refreshVersion, loadWorkout]);

  const focusedDate = focusedPlan?.date;
  useEffect(() => {
    if (!focusedDate) return;
    const controller = new AbortController();
    getTodayPlan(focusedDate, { signal: controller.signal })
      .then(setFocusedPlan)
      .catch((error: unknown) => {
        if (!isAbortError(error)) setIsServiceOffline(true);
      });
    return () => controller.abort();
  }, [focusedDate, refreshVersion]);

  const clearWorkout = useCallback(() => {
    selectedDate.current = null;
    workoutRequest.current?.abort();
    workoutRequest.current = null;
    setDailyWorkout(null);
    setIsDailyWorkoutLoading(false);
  }, []);

  const refreshDashboard = useCallback(() => setRefreshVersion((version) => version + 1), []);

  return {
    refreshVersion,
    focusedPlan,
    setFocusedPlan,
    dataSyncStatus,
    dataSyncError,
    clearWorkout,
    dailyWorkout,
    dashboard,
    isDailyWorkoutLoading,
    isServiceOffline,
    loadWorkout,
    refreshDashboard,
    search,
    setSearch,
    todayPlan,
    timeline
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
