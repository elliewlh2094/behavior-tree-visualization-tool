import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Class strategy: useTheme adds/removes `dark` on <html> based on the user's
  // theme preference (light / dark / system). Phase 3 (T8) wires `dark:`
  // variants throughout the UI; declaring it now is benign because no `dark:`
  // classes exist yet.
  darkMode: 'class',
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
