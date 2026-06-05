import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "#d8dee8",
        canvas: "#f3f5f8",
        ink: "#172033",
        line: "#d6dce6",
        muted: "#64748b",
        panel: "#f7f9fc",
        surface: "#ffffff",
        "surface-muted": "#eef2f6"
      }
    }
  },
  plugins: []
};

export default config;
