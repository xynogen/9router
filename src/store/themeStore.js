"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEME_CONFIG } from "@/shared/constants/config";

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: THEME_CONFIG.defaultTheme,
      accent: "coral",
      setAccent: (accent) => {
        set({ accent });
        applyAccent(accent);
      },

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        set({ theme: newTheme });
        applyTheme(newTheme);
      },

      initTheme: () => {
        applyTheme(get().theme);
        applyAccent(get().accent);
      },
    }),
    {
      name: THEME_CONFIG.storageKey,
    }
  )
);

// Apply theme to document
function applyTheme(theme) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  const effectiveTheme = theme === "system" ? systemTheme : theme;

  if (effectiveTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

// CSS owns the preset palettes; only known names can reach the DOM.
const accents = new Set(["coral", "blue", "teal", "violet", "pink", "green", "cyan", "indigo", "red", "gold"]);
function applyAccent(accent) {
  if (typeof document !== "undefined") document.documentElement.dataset.accent = accents.has(accent) ? accent : "coral";
}

export default useThemeStore;

