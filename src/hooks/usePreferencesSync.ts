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

// 把使用者選擇的色彩系列，以 CSS 自訂屬性的形式同步到 :root 上，涵蓋每個
// （role, kind）組合，並依解析後的主題挑選淺色或暗色色階。
// 元件透過行內 style={{ … var(...) }} 使用結果。
//
// 每次執行產生 6 個角色 × 8 種類型 = 48 個變數。成本很低：只在使用者
// 編輯色彩系列、切換主題，或作業系統主題改變時執行。
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
