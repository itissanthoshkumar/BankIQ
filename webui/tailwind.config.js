/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        // neutral zinc base + one desaturated accent (teal) per the skill's color rule
        accent: {
          DEFAULT: "#0d9488",
          fg: "#0f766e",
          soft: "#f0fdfa",
          ring: "#5eead4",
        },
      },
      borderRadius: { xl2: "1.25rem", xl3: "1.75rem" },
      boxShadow: {
        diffuse: "0 20px 40px -18px rgba(24,24,27,0.10)",
        soft: "0 1px 2px rgba(24,24,27,0.05), 0 8px 24px -12px rgba(24,24,27,0.08)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-3px)" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        floaty: "floaty 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
