import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeDataChanges } from "./api/data-sync";
vi.mock("./api/data-sync", () => ({ subscribeDataChanges: vi.fn(() => () => {}) }));
import { App } from "./app/App";

const todayPlanResponse = {
  ok: true,
  plan: {
    schema_version: 1,
    id: "plan-2026-06-20",
    date: "2026-06-20",
    title: "背 + 后束 + 二头 / 已练动作复用",
    duration_min: 60,
    user_intent: "复用已经练过的动作",
    user_note: "腰部疲劳时每个动作减少一组。",
    goals: ["背部", "肩后束", "手臂前侧"],
    readiness: {},
    computed_expected_stimulus: {
      latissimus_dorsi: 100,
      deltoid_posterior: 61
    },
    blocks: [
      {
        type: "mobility",
        name: "动态热身",
        exercises: [
          {
            name: "泡沫轴胸椎屈伸",
            sets: [{ reps: 12, rpe: 7 }]
          }
        ]
      },
      {
        type: "strength",
        name: "背部主训练",
        exercises: [
          {
            name: "坐姿划船（对握）",
            exercise_id: "horizontal_row",
            sets: [
              { weight_kg: 24.75, reps: 12, rpe: 7 },
              { weight_kg: 24.75, reps: 10, rpe: 7 }
            ]
          },
          {
            name: "哑铃交替垂式弯举",
            exercise_id: "hammer_curl",
            sets: [{ weight_kg: 5, reps: 12, rpe: 7 }]
          }
        ]
      }
    ]
  },
  preview: {
    id: "plan-2026-06-20",
    date: "2026-06-20",
    title: "背 + 后束 + 二头 / 已练动作复用",
    totalSets: 4,
    totalVolumeKg: 0,
    computedExpectedStimulus: {
      latissimus_dorsi: 100,
      deltoid_posterior: 61
    },
    warnings: []
  },
  sourcePlanFile: "data/plans/2026/2026-06-20.generated.yaml"
};

describe("App", () => {
  beforeEach(() => {
    vi.mocked(subscribeDataChanges).mockClear();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/api/model/settings")) {
          return Response.json({
            ok: true,
            settings: { provider: "DeepSeek", configured: true, writable: true }
          });
        }

        if (url.endsWith("/api/dsh-web")) {
          return new Response(
            JSON.stringify({
              ok: true,
              status: "ready",
              url: "http://127.0.0.1:3080/?token=test"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (url.includes("/api/plans/today")) {
          return new Response(JSON.stringify(todayPlanResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }

        if (url.includes("/api/health")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              service: "local-app-service",
              version: "0.0.0"
            })
          } as Response;
        }

        if (url.includes("/api/automation/schedule")) {
          return new Response(
            JSON.stringify({
              ok: true,
              schedule: {
                schema_version: 1,
                daily_plan: {
                  enabled: true,
                  local_time: "09:00",
                  time_zone: "Asia/Shanghai",
                  missed_run_policy: "run_once"
                }
              },
              state: {
                schema_version: 2,
                daily_plan: {
                  last_run: {
                    run_id: "run-1",
                    trigger_type: "scheduled",
                    status: "succeeded",
                    session_id: "fitness-daily-2026-06-20",
                    started_at: "2026-06-20T01:00:00Z",
                    outcome: {
                      code: "already_exists",
                      planFile: "plans/2026/2026-06-20.generated.yaml"
                    }
                  }
                }
              },
              next_run_at: "2026-06-21T09:00:00+08:00"
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (url.includes("/api/agent/settings")) {
          return new Response(
            JSON.stringify({
              ok: true,
              settings: {
                schema_version: 1,
                instructions: "你是一名测试用健身教练。"
              }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        if (url.endsWith("/api/workouts")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              timeline: [
                {
                  id: "workout-2026-06-19",
                  date: "2026-06-19",
                  title: "Pull Day",
                  totalSets: 3,
                  totalVolumeKg: 240,
                  intensity: 62,
                  group: "earlier"
                }
              ]
            })
          } as Response;
        }

        if (url.includes("/api/workouts/2026-06-19")) {
          return {
            ok: true,
            json: async () => ({
              ok: true,
              workout: {
                id: "workout-2026-06-19",
                date: "2026-06-19",
                title: "Pull Day",
                totalSets: 3,
                totalVolumeKg: 240,
                readiness: {},
                blocks: [],
                bodyProjection: []
              }
            })
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            ok: true,
            projection: {
              date: "2026-06-20",
              hasTrainingData: true,
              lastWorkoutDate: "2026-06-19",
              daysSinceLastWorkout: 1,
              weeklyTrainingSessions: 3,
              weeklyTrainingMinutes: 180,
              weeklyStrengthSets: 51,
              weeklyAverageRpe: 7,
              muscleSetDistribution: [
                { groupId: "chest", labelZh: "胸", sets: 25 },
                { groupId: "shoulders", labelZh: "肩", sets: 24 },
                { groupId: "back", labelZh: "背", sets: 19 }
              ],
              coachInsight: "背阔肌恢复不足；下肢训练量偏低。",
              computedStimulus: {},
              computedRecoveryLoad: {},
              bodyProjection: [
                {
                  muscleId: "latissimus_dorsi",
                  labelZh: "背阔肌",
                  intensity: 62,
                  recoveryScore: 74,
                  selected: false,
                  hovered: false,
                  status: "orange"
                }
              ],
              recentWorkouts: []
            }
          })
        } as Response;
      })
    );
  });

  it("renders the dashboard projection", async () => {
    render(<App />);

    expect(screen.getByLabelText("Workout timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("Body dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Training insights")).toBeInTheDocument();
    expect(await screen.findByText("今天的身体状态")).toBeInTheDocument();
    expect(await screen.findAllByText("距上次训练")).toHaveLength(2);
    expect(screen.getAllByText("背阔肌恢复不足；下肢训练量偏低。")).toHaveLength(2);
    expect(screen.getByLabelText("首页身体数据")).toBeInTheDocument();
    expect(screen.getByText("近 7 日训练")).toBeInTheDocument();
    expect(screen.getByText("力量训练")).toBeInTheDocument();
    expect(screen.getByLabelText("肌群训练分布")).toHaveTextContent("胸");
    expect(screen.getByLabelText("肌群训练分布")).toHaveTextContent("25");
    expect(screen.queryByRole("button", { name: /生成今日计划/ })).not.toBeInTheDocument();
  });

  it("keeps the timeline open after selecting a workout date", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "展开训练时间线" }));
    fireEvent.click(await screen.findByRole("button", { name: /Pull Day/ }));

    expect(await screen.findByText("Daily workout · 2026-06-19")).toBeInTheDocument();
    expect(screen.queryByLabelText("今日计划")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起训练时间线" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search workouts")).toBeInTheDocument();
  });

  it.each([false, true])(
    "shows today's plan after selecting today (workout: %s)",
    async (hasWorkout) => {
      const original = fetch;
      vi.stubGlobal(
        "fetch",
        vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
          String(input).includes("/api/workouts/2026-06-20")
            ? Promise.resolve(
                hasWorkout
                  ? Response.json({
                      ok: true,
                      workout: {
                        id: "workout-2026-06-20",
                        date: "2026-06-20",
                        title: "今日已完成训练",
                        totalSets: 3,
                        totalVolumeKg: 240,
                        readiness: {},
                        blocks: [],
                        bodyProjection: []
                      }
                    })
                  : Response.json({ error: "Not found" }, { status: 404 })
              )
            : original(input, init)
        )
      );
      render(<App />);
      await screen.findByRole("button", { name: "查看完整计划" });
      fireEvent.click(screen.getByRole("button", { name: "展开训练时间线" }));
      fireEvent.click(screen.getByRole("button", { name: /今天/ }));
      const insights = within(screen.getByLabelText("Training insights"));
      expect(
        await insights.findByText(hasWorkout ? "今日已完成训练" : "当天没有训练记录")
      ).toBeVisible();
      expect(insights.getByLabelText("今日计划")).toHaveTextContent(todayPlanResponse.plan.title);
      fireEvent.click(insights.getByRole("button", { name: "查看完整计划" }));
      expect(screen.getByLabelText("今日计划详情")).toBeVisible();
    }
  );

  it("opens the full today plan and copies every set", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "查看完整计划" }));

    expect(screen.getByLabelText("今日计划详情")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "背 + 后束 + 二头 / 已练动作复用" })).toBeVisible();
    expect(screen.getByText("哑铃交替垂式弯举")).toBeVisible();
    expect(screen.getByText("24.75 kg × 12 · RPE 7")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "复制今日计划" }));

    expect(await screen.findByText("已复制，可直接粘贴")).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("第 2 组：24.75 kg × 10 · RPE 7")
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("训练提示：腰部疲劳时每个动作减少一组。")
    );

    fireEvent.click(screen.getByRole("button", { name: "返回身体概览" }));
    expect(screen.getByLabelText("Body dashboard")).toBeInTheDocument();
  });

  it("opens Agent settings with coach instructions and automation status", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "配置后台" }));

    expect(await screen.findByRole("heading", { name: "设置" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "教练偏好" }));
    expect(await screen.findByDisplayValue("你是一名测试用健身教练。")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "模型连接" }));
    expect(await screen.findByText("已配置密钥")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "自动计划" }));
    expect(screen.getByDisplayValue("09:00")).toBeVisible();
    expect(screen.getByDisplayValue("Asia/Shanghai")).toBeVisible();
    expect(screen.getByText(/succeeded · already_exists/)).toBeVisible();
  });

  it("refreshes the timeline on validated file changes and retains it for invalid data", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "展开训练时间线" }));
    expect(await screen.findByRole("button", { name: /Pull Day/ })).toBeVisible();
    const requests = () =>
      vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/api/workouts")).length;
    const count = requests();
    const receive = vi.mocked(subscribeDataChanges).mock.calls[0][0];
    act(() => receive({ v: 1, type: "fitness.data-invalid", at: new Date().toISOString() }));
    expect(screen.getByText(/数据文件尚未通过校验/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Pull Day/ })).toBeVisible();
    expect(requests()).toBe(count);
    act(() =>
      receive({
        v: 1,
        type: "fitness.data-changed",
        revision: "next",
        changed: ["workouts"],
        at: new Date().toISOString()
      })
    );
    await waitFor(() => expect(requests()).toBeGreaterThan(count));
    expect(screen.queryByText(/数据文件尚未通过校验/)).not.toBeInTheDocument();
  });

  it("mounts the official DSH conversation inside the body stage", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /和训练 Agent 对话/ }));

    expect(await screen.findByLabelText("训练 Agent 对话")).toBeVisible();
    expect(await screen.findByTitle("训练 Agent 会话")).toHaveAttribute(
      "src",
      "http://127.0.0.1:3080/?token=test"
    );
    expect(screen.getByRole("button", { name: "收起 Agent 对话" })).toHaveTextContent("收起");

    const frame = screen.getByTitle("训练 Agent 会话");
    expect(frame).not.toBeVisible();
    fireEvent(
      window,
      new MessageEvent("message", {
        origin: "http://untrusted.invalid",
        source: (frame as HTMLIFrameElement).contentWindow,
        data: { v: 1, type: "fitness.surface.ready" }
      })
    );
    expect(frame).not.toBeVisible();
    fireEvent(
      window,
      new MessageEvent("message", {
        origin: "http://127.0.0.1:3080",
        source: (frame as HTMLIFrameElement).contentWindow,
        data: { v: 1, type: "fitness.surface.ready" }
      })
    );
    expect(frame).toBeVisible();
    expect(screen.queryByRole("button", { name: "收起 Agent 对话" })).not.toBeInTheDocument();
    fireEvent(
      window,
      new MessageEvent("message", {
        origin: "http://127.0.0.1:3080",
        source: (frame as HTMLIFrameElement).contentWindow,
        data: { v: 1, type: "fitness.surface.collapse" }
      })
    );
    expect(screen.getByLabelText("训练 Agent 对话")).not.toBeVisible();
    expect(screen.getByRole("button", { name: /和训练 Agent 对话/ })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /和训练 Agent 对话/ }));
    await waitFor(() => expect(frame).toBeVisible());
    expect(screen.getByTitle("训练 Agent 会话")).toBe(frame);
  });

  it("blocks the conversation without a key and links to the configuration page", async () => {
    const original = fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith("/api/model/settings")
          ? Promise.resolve(
              Response.json({
                ok: true,
                settings: { provider: "DeepSeek", configured: false, writable: true }
              })
            )
          : original(input, init)
      )
    );
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /和训练 Agent 对话/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("尚未配置模型密钥");
    expect(screen.getByRole("link", { name: "前往配置后台" })).toHaveAttribute(
      "href",
      "#/settings?section=connection"
    );
    expect(screen.queryByTitle("训练 Agent 会话")).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/api/dsh-web"))).toBe(
      false
    );
  });

  it("saves a key without displaying the saved secret", async () => {
    window.history.replaceState(null, "", "/#/settings?section=connection");
    render(<App />);
    expect(await screen.findByRole("button", { name: "模型连接" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    const input = await screen.findByLabelText("DeepSeek API Key");
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: "test-only-key" } });
    fireEvent.click(screen.getByRole("button", { name: "保存模型密钥" }));
    expect(await screen.findByText(/密钥已保存/)).toBeVisible();
    expect(input).toHaveValue("");
    expect(fetch).toHaveBeenCalledWith(
      "/api/model/settings",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ apiKey: "test-only-key" }) })
    );
  });
});
