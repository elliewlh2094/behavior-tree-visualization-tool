import { describe, expect, it, beforeEach, vi } from 'vitest';
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

describe('SettingsPanel', () => {
  beforeEach(reset);

  it('hides itself when open=false (translates off-screen, aria-hidden)', () => {
    render(<SettingsPanel open={false} onClose={() => {}} />);
    const panel = screen.getByTestId('settings-panel');
    expect(panel.className).toMatch(/translate-x-full/);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders Nodes and Theme section headers when open', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText('Nodes')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });

  it('does NOT render Canvas/Edges sections (designer-owned, not user-customizable)', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.queryByText('Canvas')).toBeNull();
    expect(screen.queryByText('Edges')).toBeNull();
  });

  it('renders one ColorPicker per NodeKind', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    // Each kind row has a button labeled "<kind>: <Family>". 8 kinds total.
    expect(screen.getByRole('button', { name: /sequence: cyan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fallback: blue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /parallel: fuchsia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decorator: orange/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /action: emerald/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /condition: yellow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /root: slate/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /group: slate/i })).toBeInTheDocument();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<SettingsPanel open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close settings/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn();
    render(<SettingsPanel open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('settings-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('ESC key calls onClose', () => {
    const onClose = vi.fn();
    render(<SettingsPanel open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('picking a family for a kind updates the store', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /sequence: cyan/i }));
    fireEvent.click(screen.getByRole('radio', { name: COLOR_FAMILIES.rose.label }));
    expect(usePreferencesStore.getState().nodeFamilyByKind.Sequence).toBe('rose');
  });

  it('changing the theme toggle writes to the store', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(usePreferencesStore.getState().theme).toBe('dark');
  });

  it('Reset to Defaults requires confirmation; Yes resets', () => {
    usePreferencesStore.getState().setNodeFamily('Sequence', 'rose');
    render(<SettingsPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }));
    expect(usePreferencesStore.getState().nodeFamilyByKind.Sequence).toBe(
      DEFAULT_PREFERENCES.nodeFamilyByKind.Sequence,
    );
  });

  it('Reset to Defaults: No leaves preferences alone', () => {
    usePreferencesStore.getState().setNodeFamily('Sequence', 'rose');
    render(<SettingsPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(usePreferencesStore.getState().nodeFamilyByKind.Sequence).toBe('rose');
    expect(
      screen.getByRole('button', { name: /reset to defaults/i }),
    ).toBeInTheDocument();
  });
});
