/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      keyframes: {
        beckon: {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "25%": { transform: "translateX(-3px) rotate(-8deg)" },
          "50%": { transform: "translateX(-6px) rotate(-12deg)" },
          "75%": { transform: "translateX(-3px) rotate(-8deg)" }
        }
      },
      animation: {
        beckon: "beckon 0.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
