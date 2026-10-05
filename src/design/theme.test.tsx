import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme";
import { appThemes, resolveTheme, type ThemeDefinition } from "./theme-definitions";
import { appearanceKey, legacyAppearanceKey, parseAppearance, readAppearance } from "./appearance";
import { getThemes } from "../api/themes";
import { ThemeChoices } from "../features/settings/appearance/ThemeChoices";
vi.mock("../api/themes", () => ({ getThemes: vi.fn() }));
const installed = resolveTheme({
  ...appThemes.graphite,
  id: "forest",
  name: "Forest",
  source: "installed"
});
const catalog = (themes = [appThemes.neon, appThemes.graphite, installed], complete = true) => ({
  themes,
  complete,
  diagnostics: []
});
function Harness() {
  const state = useTheme();
  return (
    <>
      <output data-testid="theme">{state.theme.id}</output>
      <output data-testid="error">{state.error}</output>
      <input aria-label="draft" defaultValue="unsaved" />
      {state.themes.map((theme) => (
        <button key={theme.id} onClick={() => state.setThemeId(theme.id)}>
          {theme.id}
        </button>
      ))}
      <button onClick={state.reloadThemes}>reload</button>
    </>
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function mount() {
  return render(
    <ThemeProvider>
      <Harness />
    </ThemeProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute("style");
  vi.mocked(getThemes).mockResolvedValue(catalog());
});

describe("theme preferences and catalog lifecycle", () => {
  it("cancels pending font preparation when the user reselects the active radio", async () => {
    const loaded = deferred<FontFace>();
    vi.stubGlobal(
      "FontFace",
      class {
        load() {
          return loaded.promise;
        }
      }
    );
    Object.defineProperty(document, "fonts", { value: { add: vi.fn() }, configurable: true });
    const custom = resolveTheme({
      ...installed,
      assetUrls: { font: "/api/themes/forest/assets/cancel.woff2" }
    });
    vi.mocked(getThemes).mockResolvedValue(catalog([appThemes.neon, custom]));
    try {
      render(
        <ThemeProvider>
          <ThemeChoices />
        </ThemeProvider>
      );
      const choice = await screen.findByRole("radio", { name: /Forest/ });
      await waitFor(() => expect(readAppearance().themeId).toBe("neon"));
      fireEvent.click(choice);
      expect(choice).toBeChecked();
      expect(screen.getByRole("status")).toHaveTextContent("正在准备主题");
      fireEvent.click(screen.getByRole("radio", { name: /Neon/ }));
      await act(async () => {
        loaded.resolve({} as FontFace);
      });
      expect(document.documentElement.dataset.theme).toBe("neon");
      expect(readAppearance().themeId).toBe("neon");
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("migrates disabled v1 glow while accepting structurally valid installed IDs", async () => {
    localStorage.setItem(
      legacyAppearanceKey,
      JSON.stringify({ themeId: "graphite", glowEnabled: false })
    );
    expect(readAppearance()).toEqual({ themeId: "graphite", glowEnabled: true });
    expect(parseAppearance('{"themeId":"forest"}').themeId).toBe("forest");
    expect(parseAppearance('{"themeId":"../forest"}').themeId).toBe("neon");
    mount();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(appearanceKey)!)).toEqual({
        themeId: "graphite",
        glowEnabled: true
      })
    );
  });
  it("does not overwrite an installed preference on temporary service failure", async () => {
    localStorage.setItem(appearanceKey, '{"themeId":"forest"}');
    vi.mocked(getThemes).mockRejectedValue(new Error("offline"));
    mount();
    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("目录读取失败"));
    expect(readAppearance().themeId).toBe("forest");
    vi.mocked(getThemes).mockResolvedValue(catalog());
    fireEvent.click(screen.getByText("reload"));
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("forest"));
  });
  it("preserves the preference for incomplete scans but resets confirmed removal", async () => {
    localStorage.setItem(appearanceKey, '{"themeId":"forest"}');
    vi.mocked(getThemes).mockResolvedValue(catalog([], false));
    mount();
    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("无法完整读取"));
    expect(readAppearance().themeId).toBe("forest");
    expect(screen.getByRole("button", { name: /^neon$/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^graphite$/ })).toBeEnabled();
    vi.mocked(getThemes).mockResolvedValue(catalog([appThemes.neon, appThemes.graphite]));
    fireEvent.click(screen.getByText("reload"));
    await waitFor(() => expect(readAppearance().themeId).toBe("neon"));
  });
  it("keeps the last user selection when the initial directory request finishes", async () => {
    const response = deferred<ReturnType<typeof catalog>>();
    vi.mocked(getThemes).mockReturnValue(response.promise);
    mount();
    fireEvent.change(screen.getByLabelText("draft"), { target: { value: "keep me" } });
    fireEvent.click(screen.getByText("graphite"));
    await act(async () => {
      response.resolve(catalog());
    });
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("graphite"));
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe(
      appThemes.graphite.palette.accent
    );
    expect(screen.getByLabelText("draft")).toHaveValue("keep me");
  });
  it("loads an installed theme announced by another tab", async () => {
    mount();
    await waitFor(() => expect(getThemes).toHaveBeenCalled());
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: appearanceKey, newValue: '{"themeId":"forest"}' })
      );
    });
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("forest"));
  });
  it("does not apply a stale theme after slow font preparation", async () => {
    const loaded = deferred<FontFace>();
    class FakeFontFace {
      load() {
        return loaded.promise;
      }
    }
    vi.stubGlobal("FontFace", FakeFontFace);
    Object.defineProperty(document, "fonts", { value: { add: vi.fn() }, configurable: true });
    const custom: ThemeDefinition = resolveTheme({
      ...installed,
      assetUrls: { font: "/api/themes/forest/assets/font.woff2" }
    });
    vi.mocked(getThemes).mockResolvedValue(catalog([appThemes.neon, appThemes.graphite, custom]));
    mount();
    await screen.findByText("forest");
    fireEvent.click(screen.getByText("forest"));
    fireEvent.click(screen.getByText("graphite"));
    await act(async () => {
      loaded.resolve({} as FontFace);
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("graphite");
    expect(readAppearance().themeId).toBe("graphite");
    vi.unstubAllGlobals();
  });
  it("falls back to preset fonts when an optional font cannot load", async () => {
    class FailingFontFace {
      load() {
        return Promise.reject(new Error("bad font"));
      }
    }
    vi.stubGlobal("FontFace", FailingFontFace);
    const custom = resolveTheme({
      ...installed,
      id: "bad-font",
      assetUrls: { font: "/api/themes/bad-font/assets/font.woff2" }
    });
    vi.mocked(getThemes).mockResolvedValue(catalog([appThemes.neon, custom]));
    mount();
    await screen.findByText("bad-font");
    fireEvent.click(screen.getByText("bad-font"));
    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("bad-font"));
    expect(screen.getByTestId("error")).toHaveTextContent("预设字体");
    expect(document.documentElement.style.getPropertyValue("--font-body")).not.toContain(
      "FitnessTheme-"
    );
    expect(readAppearance().themeId).toBe("bad-font");
    vi.unstubAllGlobals();
  });
});
