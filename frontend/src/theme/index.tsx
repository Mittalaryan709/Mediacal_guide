import React, { createContext, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

export const palettes = {
  light: {
    surface: "#F9FAFB",
    onSurface: "#0F172A",
    surfaceSecondary: "#FFFFFF",
    onSurfaceSecondary: "#334155",
    surfaceTertiary: "#F1F5F9",
    onSurfaceTertiary: "#475569",
    brandPrimary: "#2563EB",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#14B8A6",
    brandTertiary: "#DBEAFE",
    onBrandTertiary: "#1E3A8A",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#8B5CF6",
    border: "#E2E8F0",
    divider: "#F1F5F9",
  },
  dark: {
    surface: "#080A0A",
    onSurface: "#F8FAFC",
    surfaceSecondary: "#121415",
    onSurfaceSecondary: "#CBD5E1",
    surfaceTertiary: "#1A1D1F",
    onSurfaceTertiary: "#94A3B8",
    brandPrimary: "#3B82F6",
    onBrandPrimary: "#FFFFFF",
    brandSecondary: "#2DD4BF",
    brandTertiary: "#172554",
    onBrandTertiary: "#DBEAFE",
    success: "#4ADE80",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#A78BFA",
    border: "#1F2327",
    divider: "#1A1D1F",
  },
};

export type Palette = typeof palettes.light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };

interface ThemeCtx {
  mode: "light" | "dark";
  colors: Palette;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: "dark",
  colors: palettes.dark,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"light" | "dark">("dark");

  useEffect(() => {
    storage.getItem("theme_mode", "dark").then((m) => {
      if (m === "light" || m === "dark") setMode(m);
    });
  }, []);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    storage.setItem("theme_mode", next);
  };

  return (
    <ThemeContext.Provider value={{ mode, colors: palettes[mode], toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
