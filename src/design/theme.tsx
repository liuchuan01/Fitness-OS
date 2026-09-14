import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode
} from "react";
import { appThemes, type ThemeDefinition, type ThemeId } from "./theme-definitions";
import { appearanceKey, applyAppearance, parseAppearance, readAppearance } from "./appearance";

type ThemeContextValue = {
  theme: ThemeDefinition;
  themeId: ThemeId;
  glowEnabled: boolean;
  setThemeId: (id: ThemeId) => void;
};
const ThemeContext = createContext<ThemeContextValue>({
  theme: appThemes.neon,
  themeId: "neon",
  glowEnabled: true,
  setThemeId: () => {}
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(readAppearance);
  useLayoutEffect(() => {
    applyAppearance(appearance);
    try {
      localStorage.setItem(appearanceKey, JSON.stringify(appearance));
    } catch {
      /* Appearance remains usable if storage is unavailable. */
    }
  }, [appearance]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === appearanceKey || event.key === null)
        setAppearance(parseAppearance(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <ThemeContext.Provider
      value={{
        theme: appThemes[appearance.themeId],
        ...appearance,
        setThemeId: (themeId) => setAppearance((value) => ({ ...value, themeId }))
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
