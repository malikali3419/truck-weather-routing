/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        risk: {
          low: "#16a34a",
          moderate: "#eab308",
          high: "#f97316",
          severe: "#dc2626",
          none: "#7e22ce",
        },
      },
    },
  },
  plugins: [],
};
