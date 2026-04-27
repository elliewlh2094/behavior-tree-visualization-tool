import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from '../../../src/components/settings/ColorPicker';
import {
  COLOR_FAMILIES,
  COLOR_FAMILY_KEYS,
} from '../../../src/components/canvas/color-families';

describe('ColorPicker (family picker)', () => {
  it('renders the kind label and current family name when collapsed', () => {
    render(<ColorPicker label="Sequence" value="cyan" onChange={() => {}} />);
    expect(screen.getByText('Sequence')).toBeInTheDocument();
    expect(screen.getByText('Cyan')).toBeInTheDocument();
  });

  it('hides the swatch grid until expanded', () => {
    render(<ColorPicker label="Sequence" value="cyan" onChange={() => {}} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('clicking the row expands a swatch per family', () => {
    render(<ColorPicker label="Sequence" value="cyan" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /sequence: cyan/i }));
    const swatches = screen.getAllByRole('radio');
    expect(swatches.length).toBe(COLOR_FAMILY_KEYS.length);
  });

  it('marks the swatch matching `value` as checked', () => {
    render(<ColorPicker label="Sequence" value="rose" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /sequence: rose/i }));
    const checked = screen.getByRole('radio', { checked: true });
    expect(checked.getAttribute('aria-label')).toBe(COLOR_FAMILIES.rose.label);
  });

  it('calls onChange with the family key when a swatch is clicked', () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Sequence" value="cyan" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sequence: cyan/i }));
    fireEvent.click(screen.getByRole('radio', { name: COLOR_FAMILIES.rose.label }));
    expect(onChange).toHaveBeenCalledWith('rose');
  });

  it('collapses back after a pick', () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Sequence" value="cyan" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /sequence: cyan/i }));
    fireEvent.click(screen.getByRole('radio', { name: COLOR_FAMILIES.rose.label }));
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
