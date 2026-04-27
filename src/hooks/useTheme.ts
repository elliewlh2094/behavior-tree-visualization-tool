import { useEffect } from 'react';
import { usePreferencesStore } from '../store/preferences-store';

// Single owner of the `dark` class on <html>. Reads the user's theme
// preference; in 'system' mode also listens to prefers-color-scheme so the
// app follows OS theme changes live.
export function useTheme(): void {
  const theme = usePreferencesStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;

    function apply(mode: 'light' | 'dark'): void {
      root.classList.toggle('dark', mode === 'dark');
    }

    if (theme === 'light' || theme === 'dark') {
      apply(theme);
      return;
    }

    // 'system': match media query and stay subscribed.
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mql.matches ? 'dark' : 'light');
    function onChange(e: MediaQueryListEvent): void {
      apply(e.matches ? 'dark' : 'light');
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);
}
