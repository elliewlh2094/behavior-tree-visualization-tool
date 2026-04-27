import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NodeKind } from '../core/model/node';
import {
  DEFAULT_NODE_FAMILY_BY_KIND,
  isColorFamilyKey,
  type ColorFamilyKey,
} from '../components/canvas/color-families';

// User-customizable visual preferences. Narrowed in v1.3 Phase 2.5: users
// only pick a *color family* per node kind; canvas/grid/edge/border
// thicknesses are designer-owned (defined in tailwind.css and theme-aware
// via .dark overrides in Phase 3). This split keeps the product's visual
// identity coherent while still letting users own the semantic palette
// for *their* tree's nodes.
//
// Lifecycle: never undoable, not part of document state, persisted to
// localStorage. Defaults preserve v1.2's per-kind visual identity
// (Sequence=cyan, Fallback=blue, etc).
export interface Preferences {
  nodeFamilyByKind: Record<NodeKind, ColorFamilyKey>;
  theme: 'light' | 'dark' | 'system';
  showGrid: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  nodeFamilyByKind: DEFAULT_NODE_FAMILY_BY_KIND,
  theme: 'light',
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

// Only data fields are persisted; actions (functions) are excluded so the
// stored shape is plain JSON, safe to migrate, and small enough to read
// at hydration without parsing closures.
function partializePreferences(state: PreferencesStoreState): Preferences {
  return {
    nodeFamilyByKind: state.nodeFamilyByKind,
    theme: state.theme,
    showGrid: state.showGrid,
  };
}

// v1 → v2 migration: the v1 schema had hex-keyed nodeBgByKind and free-form
// chrome colors. v2 narrows to a family key per kind. Reverse-mapping hex →
// family is brittle (users may have picked off-palette colors), so we drop
// the v1 customizations and seed v2 defaults. Acceptable because v1.3 has
// not shipped — anyone with v1 storage is a developer/internal tester.
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
      // Sugar that scopes one kind's family update without forcing callers
      // to splat the rest of nodeFamilyByKind.
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
      // Defensive merge: if persisted data is missing a kind (e.g., we add
      // a NodeKind in the future), the missing key falls back to default.
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
