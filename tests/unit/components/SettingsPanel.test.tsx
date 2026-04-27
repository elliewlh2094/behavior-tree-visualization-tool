import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../../../src/components/settings/SettingsPanel';
import {
  DEFAULT_PREFERENCES,
  usePreferencesStore,
} from '../../../src/store/preferences-store';
import { COLOR_FAMILIES } from '../../../src/components/canvas/color-families';

function reset(): void {
  localStorage.clear();
  usePreferencesStore.setState({ ...DEFAULT_PREFERENCES });
}

describe('SettingsPanel (tab content)', () => {
  beforeEach(reset);

  it('renders Node Color, Theme, and Grid Background sections', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('Node Color')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Grid Background')).toBeInTheDocument();
  });

  it('renders one ColorPicker per NodeKind', () => {
    render(<SettingsPanel />);
    expect(screen.getByRole('button', { name: /sequence: cyan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fallback: blue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parallel: fuchsia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decorator: orange/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /action: emerald/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /condition: yellow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /root: slate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /group: slate/i })).toBeInTheDocument();
  });

  it('picking a family for a kind updates the store', () => {
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /sequence: cyan/i }));
    fireEvent.click(screen.getByRole('radio', { name: COLOR_FAMILIES.rose.label }));
    expect(usePreferencesStore.getState().nodeFamilyByKind.Sequence).toBe('rose');
  });

  it('changing the theme toggle writes to the store', () => {
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(usePreferencesStore.getState().theme).toBe('dark');
  });

  it('Grid Background pill toggles showGrid via On/Off radios', () => {
    render(<SettingsPanel />);
    expect(usePreferencesStore.getState().showGrid).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
    expect(usePreferencesStore.getState().showGrid).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: 'On' }));
    expect(usePreferencesStore.getState().showGrid).toBe(true);
  });

  it('Reset to Defaults requires confirmation; Yes resets', () => {
    usePreferencesStore.getState().setNodeFamily('Sequence', 'rose');
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }));
    expect(usePreferencesStore.getState().nodeFamilyByKind.Sequence).toBe(
      DEFAULT_PREFERENCES.nodeFamilyByKind.Sequence,
    );
  });

  it('Reset to Defaults: No leaves preferences alone', () => {
    usePreferencesStore.getState().setNodeFamily('Sequence', 'rose');
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(usePreferencesStore.getState().nodeFamilyByKind.Sequence).toBe('rose');
    expect(
      screen.getByRole('button', { name: /reset to defaults/i }),
    ).toBeInTheDocument();
  });
});
