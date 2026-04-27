import { useEffect, useState } from 'react';
import { usePreferencesStore } from '../store/preferences-store';

// 'system' resolves to the current OS preference and stays subscribed to
// matchMedia changes so the app follows OS theme switches live. Centralized
// here so useTheme (toggles `dark` class) and usePreferencesSync (writes
// per-kind CSS vars) read from one source of truth.
//
// Defensive against environments without window.matchMedia (jsdom in tests
// before our polyfill loads, very old browsers, etc.) — defaults to light.
function getMql(): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.matchMedia !== 'function') return null;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  return mql ?? null;
}

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = usePreferencesStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() => getMql()?.matches ?? false);

  useEffect(() => {
    const mql = getMql();
    if (!mql) return;
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
