import { useEffect } from 'react';
import { useResolvedTheme } from './useResolvedTheme';

// Single owner of the `dark` class on <html>. Reads the resolved theme so
// 'system' mode follows OS theme changes via the same matchMedia subscription
// that usePreferencesSync uses.
export function useTheme(): void {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);
}
