import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  appThemes,
  applyTheme,
  prepareTheme,
  type ThemeDefinition,
  type ThemeId
} from "./theme-definitions";
import {
  appearanceKey,
  legacyAppearanceKey,
  parseAppearance,
  readAppearance,
  saveAppearance
} from "./appearance";
import { getInitialTheme } from "./theme-bootstrap";
import { getThemes } from "../api/themes";

type ThemeContextValue = {
  theme: ThemeDefinition;
  themeId: ThemeId;
  glowEnabled: boolean;
  themes: ThemeDefinition[];
  loading: boolean;
  pendingThemeId: string | null;
  error: string | null;
  diagnostics: string[];
  reloadThemes: () => void;
  setThemeId: (id: ThemeId) => void;
};
const builtins = Object.values(appThemes);
const ThemeContext = createContext<ThemeContextValue>({
  theme: appThemes.neon,
  themeId: "neon",
  glowEnabled: true,
  themes: builtins,
  loading: false,
  pendingThemeId: null,
  error: null,
  diagnostics: [],
  reloadThemes: () => {},
  setThemeId: () => {}
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [themes, setThemes] = useState(builtins);
  const [loading, setLoading] = useState(true);
  const [pendingThemeId, setPendingThemeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const desired = useRef(readAppearance().themeId);
  const catalog = useRef(builtins);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const activate = useCallback(async (next: ThemeDefinition, persist: boolean) => {
    const version = ++sequence.current;
    setPendingThemeId(next.id);
    try {
      const prepared = await prepareTheme(next);
      if (!mounted.current || version !== sequence.current) return;
      setTheme(prepared.theme);
      if (prepared.warning) setError(prepared.warning);
      setPendingThemeId(null);
      if (persist) saveAppearance(next.id);
    } catch {
      if (!mounted.current || version !== sequence.current) return;
      setPendingThemeId(null);
      setError(`主题“${next.name}”的字体未能加载，已保留当前外观。请重试或选择其他主题。`);
    }
  }, []);

  const reloadThemes = useCallback(() => {
    request.current?.abort();
    sequence.current++;
    setPendingThemeId(null);
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    void getThemes(controller.signal)
      .then((result) => {
        if (controller.signal.aborted || !mounted.current) return;
        const available = [
          ...new Map([...builtins, ...result.themes].map((item) => [item.id, item])).values()
        ];
        catalog.current = available;
        setThemes(available);
        setDiagnostics(result.diagnostics);
        const next = available.find((item) => item.id === desired.current);
        if (next) {
          void activate(next, true);
        } else if (result.complete) {
          desired.current = "neon";
          setError("原主题已移除或无法使用，已恢复默认外观。可检查主题包后重新读取。");
          void activate(appThemes.neon, true);
        } else {
          setError("主题目录暂时无法完整读取，已保留原主题偏好。请重新读取。");
        }
      })
      .catch(() => {
        if (controller.signal.aborted || !mounted.current) return;
        setError("主题目录读取失败，当前外观仍可使用；已保留原主题偏好，请重新读取。");
      })
      .finally(() => {
        if (!controller.signal.aborted && mounted.current) setLoading(false);
      });
  }, [activate]);

  const setThemeId = useCallback(
    (id: string) => {
      const next = catalog.current.find((item) => item.id === id);
      if (!next) return;
      desired.current = id;
      setError(null);
      void activate(next, true);
    },
    [activate]
  );

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    mounted.current = true;
    reloadThemes();
    const sync = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== localStorage) return;
      if (event.key !== appearanceKey && event.key !== legacyAppearanceKey && event.key !== null)
        return;
      if (event.key === legacyAppearanceKey && localStorage.getItem(appearanceKey)) return;
      desired.current = parseAppearance(event.newValue).themeId;
      const next = catalog.current.find((item) => item.id === desired.current);
      if (next) void activate(next, false);
      else reloadThemes();
    };
    window.addEventListener("storage", sync);
    return () => {
      mounted.current = false;
      sequence.current++;
      request.current?.abort();
      window.removeEventListener("storage", sync);
    };
  }, [activate, reloadThemes]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeId: theme.id,
        glowEnabled: true,
        themes,
        loading,
        pendingThemeId,
        error,
        diagnostics,
        reloadThemes,
        setThemeId
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
