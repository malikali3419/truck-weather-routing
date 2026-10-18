/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      // Theme tokens: values live in index.css and switch with the .dark class.
      colors: {
        ink: { 950: v("ink-950"), 900: v("ink-900"), 850: v("ink-850"), 800: v("ink-800"), 700: v("ink-700") },
        overlay: v("overlay"),
        fg: { DEFAULT: v("fg"), 2: v("fg-2") },
        muted: v("muted"),
        subtle: v("subtle"),
      },
      boxShadow: {
        glass: "var(--shadow-glass)",
        glow: "0 8px 28px -8px rgb(56 189 248 / 0.55)",
        "glow-emerald": "var(--shadow-glow-emerald)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
  plugins: [],
};
