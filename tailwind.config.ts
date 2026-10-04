import type { Config } from "tailwindcss";

// Paleta y tipografías tomadas de la web pública de Dos Studio.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0B",
        paper: "#FFFFFF",
        canvas: "#F7F6FB",
        violet: {
          DEFAULT: "#5430FF",
          deep: "#1B0E66",
          soft: "#EDE9FF",
        },
        graphite: "#5B5B66",
        line: "#E4E2EC",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
