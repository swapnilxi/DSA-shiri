import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        "gray-850": "#18212f",
        "gray-750": "#1f2d3d",
      },
    },
  },
  plugins: [],
};

export default config;
