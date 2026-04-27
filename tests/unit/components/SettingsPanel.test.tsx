import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SettingsPanel } from '../../../src/components/settings/SettingsPanel';
import {
  DEFAULT_PREFERENCES,
  usePreferencesStore,
} from '../../../src/store/preferences-store';

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

  it('renders all four section headers when open', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(screen.getByText('Nodes')).toBeInTheDocument();
    expect(screen.getByText('Edges')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
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

  it('clicking a Canvas Background swatch updates the store', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    // Each ColorPicker renders the same palette, so the same hex appears in
    // multiple radiogroups. Scope by the picker's aria-label to target the
    // Canvas Background picker specifically.
    const bg = screen.getByRole('radiogroup', { name: 'Background color' });
    fireEvent.click(within(bg).getByRole('radio', { name: '#475569' }));
    expect(usePreferencesStore.getState().canvasBg).toBe('#475569');
  });

  it('changing the theme toggle writes to the store', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(usePreferencesStore.getState().theme).toBe('dark');
  });

  it('Reset to Defaults requires confirmation; Yes resets', () => {
    usePreferencesStore.getState().setPreference('canvasBg', '#000000');
    render(<SettingsPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    // Confirmation row shows Yes/No, original button is gone.
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }));
    expect(usePreferencesStore.getState().canvasBg).toBe(
      DEFAULT_PREFERENCES.canvasBg,
    );
  });

  it('Reset to Defaults: No leaves preferences alone', () => {
    usePreferencesStore.getState().setPreference('canvasBg', '#000000');
    render(<SettingsPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(usePreferencesStore.getState().canvasBg).toBe('#000000');
    // Confirmation collapsed; original button is back.
    expect(
      screen.getByRole('button', { name: /reset to defaults/i }),
    ).toBeInTheDocument();
  });

  it('thickness slider for edges updates edgeThickness', () => {
    render(<SettingsPanel open={true} onClose={() => {}} />);
    const slider = screen.getByLabelText(/thickness thickness/i);
    fireEvent.change(slider, { target: { value: '3' } });
    expect(usePreferencesStore.getState().edgeThickness).toBe(3);
  });
});
