import { useEffect } from 'react';
import { usePreferencesStore } from '../store/preferences-store';
import { NODE_KINDS } from '../core/model/node';
import {
  COLOR_FAMILIES,
  NODE_ROLES,
  ROLE_SHADE_DARK,
  ROLE_SHADE_LIGHT,
  nodeVar,
} from '../components/canvas/color-families';
import { useResolvedTheme } from './useResolvedTheme';

// Mirrors the user's family choices onto :root as CSS custom properties for
// every (role, kind) pair, picking light or dark shades based on the resolved
// theme. Components consume the result through inline style={{ … var(...) }}.
//
// 6 roles × 8 kinds = 48 vars per run. Inexpensive: only fires when the user
// edits a family, switches theme, or the OS theme changes.
export function usePreferencesSync(): void {
  const nodeFamilyByKind = usePreferencesStore((s) => s.nodeFamilyByKind);
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    const root = document.documentElement;
    const shadeMap = resolvedTheme === 'dark' ? ROLE_SHADE_DARK : ROLE_SHADE_LIGHT;
    for (const kind of NODE_KINDS) {
      const family = COLOR_FAMILIES[nodeFamilyByKind[kind]];
      for (const role of NODE_ROLES) {
        root.style.setProperty(nodeVar(role, kind), family.shades[shadeMap[role]]);
      }
    }
  }, [nodeFamilyByKind, resolvedTheme]);
}
