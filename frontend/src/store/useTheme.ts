import { create } from "zustand";

export type Theme = "light" | "dark";

const KEY = "theme";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be blocked (private mode); the theme still applies for this visit.
  }
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

/** Current theme. The inline script in index.html sets it before first paint. */
export const useTheme = create<ThemeState>((set, get) => ({
  theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
  toggle: () => {
    const theme: Theme = get().theme === "dark" ? "light" : "dark";
    apply(theme);
    set({ theme });
  },
}));
