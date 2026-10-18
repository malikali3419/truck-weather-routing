import { Moon, Sun } from "lucide-react";
import { useTheme } from "../store/useTheme";

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="relative flex h-8 w-8 items-center justify-center rounded-full border border-overlay/10 bg-overlay/[0.04] text-muted transition hover:border-sky-400/40 hover:text-fg"
    >
      <Sun className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <Moon className={`absolute h-4 w-4 transition-all duration-300 ${dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
    </button>
  );
}
