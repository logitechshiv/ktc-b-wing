import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A4C86",
        brand: "#1683C4",
        greyx: "#929393",
        surface: "#F3F5F8",
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Gujarati", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
