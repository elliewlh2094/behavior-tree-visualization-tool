import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Work Sans', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.04)',
        card: '0 4px 6px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
