"use client";

import * as React from "react";
import {
  ACCENT_THEME_STORAGE_KEY,
  applyAccentColor,
  normalizeAccentColor,
  persistAccentColor,
  readAccentColor,
} from "@/theme/accent-theme";

interface AccentThemeContextValue {
  accentColor: string | null;
  resetAccentColor: () => void;
  setAccentColor: (color: string) => void;
}

const AccentThemeContext = React.createContext<AccentThemeContextValue | null>(null);

export function AccentThemeProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColorState] = React.useState<string | null>(null);
  const persistTimerRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const stored = readAccentColor();
    setAccentColorState(stored);
    applyAccentColor(stored);
  }, []);

  React.useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== ACCENT_THEME_STORAGE_KEY) return;
      const next = normalizeAccentColor(event.newValue);
      setAccentColorState(next);
      applyAccentColor(next);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  React.useEffect(
    () => () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    },
    [],
  );

  const setAccentColor = React.useCallback((color: string) => {
    const next = normalizeAccentColor(color);
    if (!next) return;
    setAccentColorState(next);
    applyAccentColor(next);
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistAccentColor(next);
      persistTimerRef.current = null;
    }, 120);
  }, []);

  const resetAccentColor = React.useCallback(() => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistAccentColor(null);
    setAccentColorState(null);
    applyAccentColor(null);
  }, []);

  const value = React.useMemo(
    () => ({ accentColor, resetAccentColor, setAccentColor }),
    [accentColor, resetAccentColor, setAccentColor],
  );

  return <AccentThemeContext.Provider value={value}>{children}</AccentThemeContext.Provider>;
}

export function useAccentTheme() {
  const context = React.useContext(AccentThemeContext);
  if (!context) throw new Error("useAccentTheme must be used within AccentThemeProvider");
  return context;
}
