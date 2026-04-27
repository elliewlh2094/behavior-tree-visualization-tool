import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_STORAGE_VERSION,
  usePreferencesStore,
} from '../../../src/store/preferences-store';
import { COLOR_FAMILIES } from '../../../src/components/canvas/color-families';

function reset(): void {
  // Persist middleware writes on every change, so a stale localStorage entry
  // would leak between tests. Clear both halves of the state.
  localStorage.clear();
  usePreferencesStore.setState({ ...DEFAULT_PREFERENCES });
}

function readStorage(): { state: unknown; version: number } | null {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as { state: unknown; version: number }) : null;
}

describe('preferences store', () => {
  beforeEach(reset);

  describe('defaults', () => {
    it('initial values match exported defaults', () => {
      const state = usePreferencesStore.getState();
      expect(state.theme).toBe(DEFAULT_PREFERENCES.theme);
      expect(state.showGrid).toBe(DEFAULT_PREFERENCES.showGrid);
      expect(state.nodeFamilyByKind).toEqual(DEFAULT_PREFERENCES.nodeFamilyByKind);
    });

    it('every NodeKind maps to a known family', () => {
      for (const family of Object.values(DEFAULT_PREFERENCES.nodeFamilyByKind)) {
        expect(family in COLOR_FAMILIES).toBe(true);
      }
    });

    it('preserves v1.2 visual identity (Sequence=cyan, Action=emerald, …)', () => {
      const f = DEFAULT_PREFERENCES.nodeFamilyByKind;
      expect(f.Sequence).toBe('cyan');
      expect(f.Fallback).toBe('blue');
      expect(f.Parallel).toBe('fuchsia');
      expect(f.Decorator).toBe('orange');
      expect(f.Action).toBe('emerald');
      expect(f.Condition).toBe('yellow');
      expect(f.Root).toBe('slate');
      expect(f.Group).toBe('slate');
    });
  });

  describe('setPreference', () => {
    it('updates the theme preference', () => {
      usePreferencesStore.getState().setPreference('theme', 'dark');
      expect(usePreferencesStore.getState().theme).toBe('dark');
    });

    it('updates the per-kind family map', () => {
      usePreferencesStore.getState().setPreference('nodeFamilyByKind', {
        ...DEFAULT_PREFERENCES.nodeFamilyByKind,
        Sequence: 'rose',
      });
      expect(usePreferencesStore.getState().nodeFamilyByKind.Sequence).toBe('rose');
      expect(usePreferencesStore.getState().nodeFamilyByKind.Fallback).toBe(
        DEFAULT_PREFERENCES.nodeFamilyByKind.Fallback,
      );
    });

    it('does not mutate other preferences', () => {
      usePreferencesStore.getState().setPreference('theme', 'dark');
      expect(usePreferencesStore.getState().showGrid).toBe(
        DEFAULT_PREFERENCES.showGrid,
      );
    });
  });

  describe('setNodeFamily', () => {
    it('updates one kind without splatting the rest', () => {
      usePreferencesStore.getState().setNodeFamily('Sequence', 'rose');
      const next = usePreferencesStore.getState().nodeFamilyByKind;
      expect(next.Sequence).toBe('rose');
      expect(next.Fallback).toBe(DEFAULT_PREFERENCES.nodeFamilyByKind.Fallback);
      expect(next.Action).toBe(DEFAULT_PREFERENCES.nodeFamilyByKind.Action);
    });
  });

  describe('toggleGrid', () => {
    it('flips showGrid', () => {
      expect(usePreferencesStore.getState().showGrid).toBe(true);
      usePreferencesStore.getState().toggleGrid();
      expect(usePreferencesStore.getState().showGrid).toBe(false);
      usePreferencesStore.getState().toggleGrid();
      expect(usePreferencesStore.getState().showGrid).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('restores all defaults after several customizations', () => {
      const s = usePreferencesStore.getState();
      s.setPreference('theme', 'dark');
      s.setNodeFamily('Sequence', 'rose');
      s.toggleGrid();

      usePreferencesStore.getState().resetAll();

      const after = usePreferencesStore.getState();
      expect(after.theme).toBe(DEFAULT_PREFERENCES.theme);
      expect(after.showGrid).toBe(DEFAULT_PREFERENCES.showGrid);
      expect(after.nodeFamilyByKind).toEqual(DEFAULT_PREFERENCES.nodeFamilyByKind);
    });
  });

  describe('persistence', () => {
    it('writes to localStorage under the documented key on change', () => {
      usePreferencesStore.getState().setNodeFamily('Sequence', 'rose');
      const stored = readStorage();
      expect(stored).not.toBeNull();
      expect(stored?.version).toBe(PREFERENCES_STORAGE_VERSION);
      expect(
        (stored?.state as { nodeFamilyByKind: Record<string, string> })
          .nodeFamilyByKind.Sequence,
      ).toBe('rose');
    });

    it('persists only the documented Preferences keys', () => {
      usePreferencesStore.getState().toggleGrid();
      const stored = readStorage();
      const persistedKeys = Object.keys(stored?.state as object).sort();
      expect(persistedKeys).toEqual(
        Object.keys(DEFAULT_PREFERENCES).sort(),
      );
    });

    it('reflects resetAll back into localStorage', () => {
      usePreferencesStore.getState().setPreference('theme', 'dark');
      usePreferencesStore.getState().resetAll();
      const stored = readStorage();
      expect((stored?.state as { theme: string }).theme).toBe(
        DEFAULT_PREFERENCES.theme,
      );
    });

    it('rehydrates from a seeded v2 entry on store re-import', async () => {
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          state: {
            ...DEFAULT_PREFERENCES,
            nodeFamilyByKind: {
              ...DEFAULT_PREFERENCES.nodeFamilyByKind,
              Sequence: 'rose',
            },
          },
          version: PREFERENCES_STORAGE_VERSION,
        }),
      );
      vi.resetModules();
      const mod = await import('../../../src/store/preferences-store');
      expect(
        mod.usePreferencesStore.getState().nodeFamilyByKind.Sequence,
      ).toBe('rose');
    });

    it('falls back to defaults when localStorage holds garbage', async () => {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, '{not-json');
      vi.resetModules();
      const mod = await import('../../../src/store/preferences-store');
      const state = mod.usePreferencesStore.getState();
      expect(state.theme).toBe(DEFAULT_PREFERENCES.theme);
      expect(state.nodeFamilyByKind).toEqual(
        DEFAULT_PREFERENCES.nodeFamilyByKind,
      );
    });

    it('migrates a v1 entry by seeding v2 defaults', async () => {
      // v1 schema: hex-keyed node bgs + per-token chrome colors.
      // The migrate function discards the v1 customizations.
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          state: {
            canvasBg: '#000000',
            nodeBgByKind: { Sequence: '#ff0000' },
            theme: 'dark',
            showGrid: false,
          },
          version: 1,
        }),
      );
      vi.resetModules();
      const mod = await import('../../../src/store/preferences-store');
      const state = mod.usePreferencesStore.getState();
      expect(state.nodeFamilyByKind).toEqual(
        mod.DEFAULT_PREFERENCES.nodeFamilyByKind,
      );
      expect(state.theme).toBe(mod.DEFAULT_PREFERENCES.theme);
      expect(state.showGrid).toBe(mod.DEFAULT_PREFERENCES.showGrid);
    });
  });
});
