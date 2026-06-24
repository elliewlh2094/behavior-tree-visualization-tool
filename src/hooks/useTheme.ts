import { useEffect } from 'react';
import { useResolvedTheme, useSystemTheme } from './useResolvedTheme';

function applyDarkClass(resolved: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

// Editor owner of the `dark` class on <html>. Reads the resolved preference so
// 'system' mode follows OS theme changes via the matchMedia subscription, and
// an explicit Light/Dark choice in Settings overrides the OS. Mounted by
// EditorRoute so the editor — and only the editor — honors the saved theme.
export function useTheme(): void {
  const resolved = useResolvedTheme();
  useEffect(() => applyDarkClass(resolved), [resolved]);
}

// Landing owner of the `dark` class. Follows the OS/browser only — the landing
// page has no theme control, so the saved editor preference is intentionally
// ignored. Returns the resolved system theme so the caller can pick matching
// assets (e.g. the light/dark logo).
export function useSystemThemeClass(): 'light' | 'dark' {
  const system = useSystemTheme();
  useEffect(() => applyDarkClass(system), [system]);
  return system;
}
