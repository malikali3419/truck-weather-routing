/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        // Deep navy surfaces
        ink: {
          950: "#060a13",
          900: "#0a101d",
          850: "#0d1424",
          800: "#111a2e",
          700: "#1a2540",
        },
      },
      boxShadow: {
        glass: "0 10px 40px -12px rgb(0 0 0 / 0.65), inset 0 1px 0 rgb(255 255 255 / 0.04)",
        glow: "0 8px 28px -8px rgb(56 189 248 / 0.55)",
        "glow-emerald": "0 8px 28px -10px rgb(52 211 153 / 0.45)",
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
