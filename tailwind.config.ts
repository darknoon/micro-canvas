import type { Config } from "tailwindcss"
import colors from "tailwindcss/colors"

export default {
  content: ["src/*.ts"],
  theme: {
    extend: {
      colors: {
        brand: colors.indigo,
      },
    },
  },
  darkMode: [
    "variant",
    ["@media (prefers-color-scheme: dark) { &:not(.light *) }", "&:is(.dark *)"],
  ],
  plugins: [],
} satisfies Config
