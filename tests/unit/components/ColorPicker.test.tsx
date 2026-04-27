import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ColorPicker,
  COLOR_PICKER_PALETTE,
} from '../../../src/components/settings/ColorPicker';

describe('ColorPicker', () => {
  it('renders one swatch per palette entry', () => {
    render(<ColorPicker value="#ffffff" onChange={() => {}} label="Background" />);
    const swatches = screen.getAllByRole('radio');
    expect(swatches.length).toBe(COLOR_PICKER_PALETTE.length);
  });

  it('marks the swatch matching `value` as checked (case-insensitive)', () => {
    render(<ColorPicker value="#ECFEFF" onChange={() => {}} />);
    const checked = screen.getByRole('radio', { checked: true });
    expect(checked.getAttribute('aria-label')).toBe('#ecfeff');
  });

  it('calls onChange with the swatch hex when clicked', () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#ffffff" onChange={onChange} />);
    const target = screen.getByRole('radio', { name: '#ecfeff' });
    fireEvent.click(target);
    expect(onChange).toHaveBeenCalledWith('#ecfeff');
  });

  it('renders the label text when provided', () => {
    render(<ColorPicker value="#ffffff" onChange={() => {}} label="Background" />);
    expect(screen.getByText('Background')).toBeInTheDocument();
  });
});
