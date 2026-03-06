import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f6f3",
        ink: "#0f172a",
        mist: "#6b7280",
        accent: "#0f766e",
        "accent-soft": "#dff6f1"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.07)"
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(circle at 5% 5%, rgba(16, 185, 129, 0.18), transparent 38%), radial-gradient(circle at 95% 0%, rgba(59, 130, 246, 0.12), transparent 40%)"
      }
    }
  },
  plugins: []
};

export default config;
