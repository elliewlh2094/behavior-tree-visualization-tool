import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_STORAGE_VERSION,
  usePreferencesStore,
} from '../../../src/store/preferences-store';

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
      expect(state.canvasBg).toBe(DEFAULT_PREFERENCES.canvasBg);
      expect(state.gridLineColor).toBe(DEFAULT_PREFERENCES.gridLineColor);
      expect(state.edgeColor).toBe(DEFAULT_PREFERENCES.edgeColor);
      expect(state.edgeThickness).toBe(DEFAULT_PREFERENCES.edgeThickness);
      expect(state.nodeBorderThickness).toBe(DEFAULT_PREFERENCES.nodeBorderThickness);
      expect(state.nodeBgByKind).toEqual(DEFAULT_PREFERENCES.nodeBgByKind);
      expect(state.theme).toBe(DEFAULT_PREFERENCES.theme);
      expect(state.showGrid).toBe(DEFAULT_PREFERENCES.showGrid);
    });

    it('exposes a default for every NodeKind', () => {
      const kinds: Array<keyof typeof DEFAULT_PREFERENCES.nodeBgByKind> = [
        'Root',
        'Sequence',
        'Fallback',
        'Parallel',
        'Decorator',
        'Action',
        'Condition',
        'Group',
      ];
      for (const k of kinds) {
        expect(DEFAULT_PREFERENCES.nodeBgByKind[k]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe('setPreference', () => {
    it('updates a string-valued preference', () => {
      usePreferencesStore.getState().setPreference('canvasBg', '#000000');
      expect(usePreferencesStore.getState().canvasBg).toBe('#000000');
    });

    it('updates a numeric preference', () => {
      usePreferencesStore.getState().setPreference('edgeThickness', 2.5);
      expect(usePreferencesStore.getState().edgeThickness).toBe(2.5);
    });

    it('updates the theme preference', () => {
      usePreferencesStore.getState().setPreference('theme', 'dark');
      expect(usePreferencesStore.getState().theme).toBe('dark');
    });

    it('updates the per-kind node background map', () => {
      usePreferencesStore.getState().setPreference('nodeBgByKind', {
        ...DEFAULT_PREFERENCES.nodeBgByKind,
        Sequence: '#123456',
      });
      expect(usePreferencesStore.getState().nodeBgByKind.Sequence).toBe('#123456');
      expect(usePreferencesStore.getState().nodeBgByKind.Fallback).toBe(
        DEFAULT_PREFERENCES.nodeBgByKind.Fallback,
      );
    });

    it('does not mutate other preferences', () => {
      usePreferencesStore.getState().setPreference('canvasBg', '#000000');
      expect(usePreferencesStore.getState().edgeColor).toBe(
        DEFAULT_PREFERENCES.edgeColor,
      );
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
      s.setPreference('canvasBg', '#000000');
      s.setPreference('edgeThickness', 2);
      s.setPreference('theme', 'dark');
      s.toggleGrid();

      usePreferencesStore.getState().resetAll();

      const after = usePreferencesStore.getState();
      expect(after.canvasBg).toBe(DEFAULT_PREFERENCES.canvasBg);
      expect(after.edgeThickness).toBe(DEFAULT_PREFERENCES.edgeThickness);
      expect(after.theme).toBe(DEFAULT_PREFERENCES.theme);
      expect(after.showGrid).toBe(DEFAULT_PREFERENCES.showGrid);
    });
  });

  describe('persistence', () => {
    it('writes to localStorage under the documented key on change', () => {
      usePreferencesStore.getState().setPreference('canvasBg', '#123456');
      const stored = readStorage();
      expect(stored).not.toBeNull();
      expect(stored?.version).toBe(PREFERENCES_STORAGE_VERSION);
      expect((stored?.state as { canvasBg: string }).canvasBg).toBe('#123456');
    });

    it('persists the full Preferences shape (no actions, no extra keys)', () => {
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

    it('rehydrates from a seeded localStorage entry on store re-import', async () => {
      // Seed a value, then reset modules and re-import so the store
      // initializes from the persisted snapshot rather than DEFAULT_PREFERENCES.
      localStorage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          state: { ...DEFAULT_PREFERENCES, canvasBg: '#abcdef' },
          version: PREFERENCES_STORAGE_VERSION,
        }),
      );
      vi.resetModules();
      const mod = await import('../../../src/store/preferences-store');
      expect(mod.usePreferencesStore.getState().canvasBg).toBe('#abcdef');
    });

    it('falls back to defaults when localStorage holds garbage', async () => {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, '{not-json');
      vi.resetModules();
      const mod = await import('../../../src/store/preferences-store');
      const state = mod.usePreferencesStore.getState();
      expect(state.canvasBg).toBe(DEFAULT_PREFERENCES.canvasBg);
      expect(state.theme).toBe(DEFAULT_PREFERENCES.theme);
    });
  });
});
