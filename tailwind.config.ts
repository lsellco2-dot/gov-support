import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A2233",
        primary: { DEFAULT: "#23408E", dark: "#1A3070", light: "#EEF2FB" },
        urgent: "#DC2626",
        open: "#0F766E"
      }
    }
  },
  plugins: []
};
export default config;
