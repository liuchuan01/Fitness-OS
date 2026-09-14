import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OnboardingEntry } from "./OnboardingEntry";
const empty = {
  stage: "empty",
  hasDraft: false,
  profileConfirmed: false,
  profileRevision: null,
  activeProgramId: null,
  firstPlanDate: null,
  hasWorkout: false,
  profileStatus: "missing",
  hasProgram: false,
  hasPlan: false
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("onboarding entry", () => {
  it("opens the coach and restores an unfinished draft after reload", async () => {
    const onAgent = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(empty))
    );
    const view = render(
      <OnboardingEntry refreshVersion={0} todayPlan={null} onPlan={vi.fn()} onAgent={onAgent} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "建立我的训练档案" }));
    expect(onAgent).toHaveBeenCalledOnce();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ ...empty, stage: "draft", hasDraft: true, profileStatus: "draft" })
      )
    );
    view.rerender(
      <OnboardingEntry refreshVersion={1} todayPlan={null} onPlan={vi.fn()} onAgent={onAgent} />
    );
    await screen.findByRole("button", { name: "继续建立训练档案" });
  });
  it("does not interpret a read failure as an empty profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("failed", { status: 422 }))
    );
    render(
      <OnboardingEntry refreshVersion={0} todayPlan={null} onPlan={vi.fn()} onAgent={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("暂时无法读取"));
    expect(screen.queryByRole("button", { name: "建立我的训练档案" })).toBeNull();
  });
});
