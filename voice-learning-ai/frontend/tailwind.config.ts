import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "gray-850": "#18212f",
        "gray-750": "#1f2d3d",
      },
    },
  },
  plugins: [],
};

export default config;
