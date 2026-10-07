import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "neon-cyan": "#00f0ff",
        "neon-magenta": "#ff00ff",
        "neon-green": "#00ff41",
        "hud-dark": "#0a0a0f",
        "hud-border": "rgba(0, 240, 255, 0.3)",
      },
      animation: {
        "pulse-neon": "pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan-line": "scan-line 3s linear infinite",
        "breathing": "breathing 4s ease-in-out infinite",
      },
      keyframes: {
        "pulse-neon": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 20px #00f0ff" },
          "50%": { opacity: ".5", boxShadow: "0 0 10px #00f0ff" },
        },
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "breathing": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
