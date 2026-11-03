import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NodeKind } from '../core/model/node';
import {
  DEFAULT_NODE_FAMILY_BY_KIND,
  isColorFamilyKey,
  type ColorFamilyKey,
} from '../components/canvas/color-families';

// 使用者可自訂的視覺偏好。v1.3 Phase 2.5 縮小了範圍：使用者只為每種節點
// 類型選擇*色彩系列*；畫布／格線／邊／邊框的粗細由設計者決定（定義在
// tailwind.css 中，並在 Phase 3 透過 .dark 覆寫支援主題）。這樣的劃分讓
// 產品的視覺辨識度保持一致，同時仍讓使用者掌握*自己*樹中節點的語意色盤。
//
// 生命週期：永遠不可 undo、不屬於文件狀態、持久保存到 localStorage。
// 預設值保留 v1.2 各類型的視覺辨識度（Sequence=cyan、Fallback=blue 等）。
export interface Preferences {
  nodeFamilyByKind: Record<NodeKind, ColorFamilyKey>;
  theme: 'light' | 'dark' | 'system';
  showGrid: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  nodeFamilyByKind: DEFAULT_NODE_FAMILY_BY_KIND,
  // 預設跟隨作業系統／瀏覽器；使用者可以在編輯器的 Settings 中覆蓋。
  theme: 'system',
  showGrid: true,
};

export interface PreferencesStoreState extends Preferences {
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setNodeFamily: (kind: NodeKind, family: ColorFamilyKey) => void;
  toggleGrid: () => void;
  resetAll: () => void;
}

export const PREFERENCES_STORAGE_KEY = 'bt-visualizer-preferences';
export const PREFERENCES_STORAGE_VERSION = 2;

// 只持久保存資料欄位；排除 action（函式），讓儲存的結構是純 JSON，
// 可以安全地遷移，而且夠小，在 hydration 時讀取不需要解析閉包。
function partializePreferences(state: PreferencesStoreState): Preferences {
  return {
    nodeFamilyByKind: state.nodeFamilyByKind,
    theme: state.theme,
    showGrid: state.showGrid,
  };
}

// v1 → v2 遷移：v1 schema 有以 hex 為值的 nodeBgByKind 與自由格式的
// 介面外框顏色。v2 縮小為每種類型一個系列鍵。從 hex 反向對應到系列並不可靠
// （使用者可能選了色盤以外的顏色），所以我們丟棄 v1 的自訂值，改為建立
// v2 預設值。這可以接受，因為 v1.3 尚未出貨：擁有 v1 儲存資料的人
// 都是開發者／內部測試者。
function migratePreferences(_persisted: unknown, version: number): Preferences {
  if (version === PREFERENCES_STORAGE_VERSION) {
    return _persisted as Preferences;
  }
  return DEFAULT_PREFERENCES;
}

export const usePreferencesStore = create<PreferencesStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      setPreference: (key, value) =>
        set({ [key]: value } as Pick<Preferences, typeof key>),
      // 語法糖：只更新單一類型的色彩系列，
      // 呼叫端不必展開 nodeFamilyByKind 的其他部分。
      setNodeFamily: (kind, family) =>
        set((state) => ({
          nodeFamilyByKind: { ...state.nodeFamilyByKind, [kind]: family },
        })),
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      resetAll: () => set({ ...DEFAULT_PREFERENCES }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: PREFERENCES_STORAGE_VERSION,
      partialize: partializePreferences,
      migrate: migratePreferences,
      // 防禦性合併：如果持久保存的資料缺少某種類型（例如日後新增 NodeKind），
      // 缺少的鍵改用預設值。
      merge: (persisted, current) => {
        const p = (persisted as Partial<Preferences>) ?? {};
        const family = { ...DEFAULT_NODE_FAMILY_BY_KIND };
        for (const [kind, fam] of Object.entries(p.nodeFamilyByKind ?? {})) {
          if (isColorFamilyKey(fam as string)) {
            family[kind as NodeKind] = fam as ColorFamilyKey;
          }
        }
        return {
          ...current,
          nodeFamilyByKind: family,
          theme: p.theme ?? DEFAULT_PREFERENCES.theme,
          showGrid: p.showGrid ?? DEFAULT_PREFERENCES.showGrid,
        };
      },
    },
  ),
);
