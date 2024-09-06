import type { Config } from 'tailwindcss';
export default {
  content: ["src/*.ts"],
  theme: {
    extend: {},
  },
  darkMode: ['variant', [
    '@media (prefers-color-scheme: dark) { &:not(.light *) }',
    '&:is(.dark *)',
  ]],
  plugins: [],
} satisfies Config;
