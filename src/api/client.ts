import { ApiError, getJson, postJson, putJson } from "./http";
import {
  dailyWorkoutResponseSchema,
  dashboardResponseSchema,
  planResponseSchema,
  timelineResponseSchema
} from "./schemas";
import {
  automationResponseSchema,
  runAutomationResponseSchema,
  saveAutomationResponseSchema
} from "./automation-schemas";
import type { DailyWorkout, DashboardResponse, TimelineWorkout, TodayPlan } from "./schemas";
import type { AutomationResponse } from "./automation-schemas";
import { dshWebResponseSchema } from "./dsh-web-schemas";
import { agentSettingsResponseSchema, type AgentSettings } from "./agent-settings-schemas";
import { modelSettingsResponseSchema } from "./model-settings-schemas";

export async function getModelSettings() {
  return (await getJson("/api/model/settings", modelSettingsResponseSchema)).settings;
}

export async function saveModelSettings(apiKey: string) {
  return (await putJson("/api/model/settings", { apiKey }, modelSettingsResponseSchema)).settings;
}

export type { DailyWorkout, DashboardResponse, TimelineWorkout, TodayPlan } from "./schemas";
export type { AutomationResponse } from "./automation-schemas";
export type { AgentSettings } from "./agent-settings-schemas";

type RequestOptions = {
  signal?: AbortSignal;
};

export function getDashboard(options?: RequestOptions): Promise<DashboardResponse> {
  return getJson("/api/dashboard", dashboardResponseSchema, options);
}

export async function getWorkouts(
  search = "",
  options?: RequestOptions
): Promise<TimelineWorkout[]> {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  const suffix = query.size > 0 ? `?${query}` : "";
  return (await getJson(`/api/workouts${suffix}`, timelineResponseSchema, options)).timeline;
}

export async function getWorkout(
  date: string,
  options?: RequestOptions
): Promise<DailyWorkout | null> {
  try {
    return (
      await getJson(
        `/api/workouts/${encodeURIComponent(date)}`,
        dailyWorkoutResponseSchema,
        options
      )
    ).workout;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getTodayPlan(
  date?: string,
  options?: RequestOptions
): Promise<TodayPlan | null> {
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  const suffix = query.size > 0 ? `?${query}` : "";

  try {
    return (await getJson(`/api/plans/today${suffix}`, planResponseSchema, options)).plan;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function getAutomation(): Promise<AutomationResponse> {
  return getJson("/api/automation/schedule", automationResponseSchema);
}

export async function getAgentSettings(): Promise<AgentSettings> {
  return (await getJson("/api/agent/settings", agentSettingsResponseSchema)).settings;
}

export async function saveAgentSettings(settings: AgentSettings): Promise<void> {
  await putJson("/api/agent/settings", settings, agentSettingsResponseSchema);
}

export async function saveAutomation(schedule: AutomationResponse["schedule"]): Promise<void> {
  await putJson("/api/automation/schedule", schedule, saveAutomationResponseSchema);
}

export async function runAutomationNow(): Promise<void> {
  await postJson("/api/automation/daily-plan/run-now", {}, runAutomationResponseSchema);
}

export function getDshWeb() {
  return getJson("/api/dsh-web", dshWebResponseSchema);
}
