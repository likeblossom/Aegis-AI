import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "#d8dee8",
        ink: "#172033",
        muted: "#64748b",
        panel: "#f7f9fc"
      }
    }
  },
  plugins: []
};

export default config;
