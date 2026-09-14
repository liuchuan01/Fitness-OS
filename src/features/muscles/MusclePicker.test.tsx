import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { muscleIds } from "../../../shared/muscle-taxonomy";
import { bodyRegions, musclesInRegion } from "./body-regions";
import { MusclePicker } from "./MusclePicker";

describe("body explorer", () => {
  it("assigns every canonical muscle to exactly one display region", () => {
    const all = bodyRegions.flatMap((region) => musclesInRegion(region.id));
    expect(all).toHaveLength(muscleIds.length);
    expect(new Set(all).size).toBe(muscleIds.length);
    expect(musclesInRegion("chest")).toContain("serratus_anterior");
  });

  it("drills down and chooses through the same selection callback, then restores focus", () => {
    const onChange = vi.fn();
    const onExplore = vi.fn();
    render(<MusclePicker value={null} onChange={onChange} onExplore={onExplore} />);
    fireEvent.click(screen.getByRole("button", { name: "选择肌肉" }));
    expect(onExplore).toHaveBeenCalledWith(true, null);
    expect(screen.queryByRole("button", { name: /背阔肌/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "背部" }));
    fireEvent.click(screen.getByRole("button", { name: /背阔肌/ }));
    expect(onChange).toHaveBeenCalledWith("latissimus_dorsi");
    expect(onExplore).toHaveBeenLastCalledWith(false, null);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择肌肉" })).toHaveFocus();
  });

  it("goes back a level and closes with Escape without changing the selected muscle", () => {
    const onChange = vi.fn();
    render(<MusclePicker value="latissimus_dorsi" onChange={onChange} onExplore={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "选择肌肉" }));
    fireEvent.click(screen.getByRole("button", { name: "背部" }));
    fireEvent.click(screen.getByRole("button", { name: "身体分区" }));
    expect(screen.getByRole("button", { name: "大腿" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
