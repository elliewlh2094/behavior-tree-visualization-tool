import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NodeKind } from '../core/model/node';

// User-customizable visual preferences. Lives in its own store, separate from
// bt-store, because preferences have a different lifecycle: never undoable,
// not part of document state, persisted to localStorage.
//
// Defaults are chosen to match the current hardcoded visuals (v1.2 baseline)
// so introducing this store causes no visual change. The settings UI lands
// in T4–T7; CSS-variable consumption in T2; persistence wired here in T3.
export interface Preferences {
  canvasBg: string;
  gridLineColor: string;
  edgeColor: string;
  edgeThickness: number;
  nodeBorderThickness: number;
  nodeBgByKind: Record<NodeKind, string>;
  theme: 'light' | 'dark' | 'system';
  showGrid: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  canvasBg: '#ffffff',
  gridLineColor: '#f1f5f9',
  edgeColor: '#64748b',
  edgeThickness: 1.5,
  nodeBorderThickness: 1,
  nodeBgByKind: {
    Root: '#f8fafc',
    Sequence: '#ecfeff',
    Fallback: '#eff6ff',
    Parallel: '#fdf4ff',
    Decorator: '#fff7ed',
    Action: '#ecfdf5',
    Condition: '#fefce8',
    Group: '#f8fafc',
  },
  theme: 'light',
  showGrid: true,
};

export interface PreferencesStoreState extends Preferences {
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  toggleGrid: () => void;
  resetAll: () => void;
}

export const PREFERENCES_STORAGE_KEY = 'bt-visualizer-preferences';
export const PREFERENCES_STORAGE_VERSION = 1;

// Only data fields are persisted; actions (functions) are excluded so the
// stored shape is plain JSON, safe to migrate, and small enough to read
// at hydration without parsing closures.
function partializePreferences(state: PreferencesStoreState): Preferences {
  return {
    canvasBg: state.canvasBg,
    gridLineColor: state.gridLineColor,
    edgeColor: state.edgeColor,
    edgeThickness: state.edgeThickness,
    nodeBorderThickness: state.nodeBorderThickness,
    nodeBgByKind: state.nodeBgByKind,
    theme: state.theme,
    showGrid: state.showGrid,
  };
}

export const usePreferencesStore = create<PreferencesStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      setPreference: (key, value) =>
        set({ [key]: value } as Pick<Preferences, typeof key>),
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      resetAll: () => set({ ...DEFAULT_PREFERENCES }),
    }),
    {
      name: PREFERENCES_STORAGE_KEY,
      version: PREFERENCES_STORAGE_VERSION,
      partialize: partializePreferences,
    },
  ),
);
