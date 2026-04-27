import { useEffect, useState } from 'react';
import { usePreferencesStore } from '../store/preferences-store';

// 'system' resolves to the current OS preference and stays subscribed to
// matchMedia changes so the app follows OS theme switches live. Centralized
// here so useTheme (toggles `dark` class) and usePreferencesSync (writes
// per-kind CSS vars) read from one source of truth.
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = usePreferencesStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange(e: MediaQueryListEvent): void {
      setSystemDark(e.matches);
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return systemDark ? 'dark' : 'light';
}
