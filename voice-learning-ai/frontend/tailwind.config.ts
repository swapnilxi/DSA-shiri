import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        /* Surface tokens — map to CSS variables for consistency.
           Defined with rgb(var(--x-rgb) / <alpha-value>) so Tailwind can
           generate opacity utilities (bg-surface-2/80, border-accent/25 …). */
        surface: {
          0: "rgb(var(--surface-0-rgb) / <alpha-value>)",
          1: "rgb(var(--surface-1-rgb) / <alpha-value>)",
          2: "rgb(var(--surface-2-rgb) / <alpha-value>)",
          3: "rgb(var(--surface-3-rgb) / <alpha-value>)",
        },
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
          accent: "var(--border-accent)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          dim: "var(--accent-dim)",
          bright: "rgb(var(--accent-bright-rgb) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--gold-rgb) / <alpha-value>)",
          dim: "var(--gold-dim)",
        },
        text: {
          primary: "rgb(var(--text-primary-rgb) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary-rgb) / <alpha-value>)",
          muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
          accent: "var(--text-accent)",
        },
        status: {
          ok: "rgb(var(--ok-rgb) / <alpha-value>)",
          warn: "rgb(var(--warn-rgb) / <alpha-value>)",
          error: "rgb(var(--error-rgb) / <alpha-value>)",
        },
      },
      /* Typography scale — restrained, readable */
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "1rem" }],
      },
      /* Consistent spacing for section rhythm */
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      /* Subtle, professional shadows */
      boxShadow: {
        panel: "0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)",
        "panel-lg": "0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)",
        accent: "0 4px 16px -6px rgba(96, 165, 250, 0.45)",
      },
      transitionTimingFunction: {
        "snap": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
