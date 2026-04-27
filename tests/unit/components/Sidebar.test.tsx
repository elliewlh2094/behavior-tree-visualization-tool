import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../../../src/components/sidebar/Sidebar';
import { EMPTY_SELECTION, useBTStore } from '../../../src/store/bt-store';
import { createEmptyTree } from '../../../src/core/model/tree';
import {
  DEFAULT_PREFERENCES,
  usePreferencesStore,
} from '../../../src/store/preferences-store';

function resetStores(): void {
  useBTStore.setState({ tree: createEmptyTree(), selection: EMPTY_SELECTION });
  localStorage.clear();
  usePreferencesStore.setState({ ...DEFAULT_PREFERENCES });
}

describe('Sidebar', () => {
  beforeEach(resetStores);

  it('renders Properties and Settings tabs', () => {
    render(<Sidebar />);
    expect(screen.getByRole('tab', { name: /properties/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
  });

  it('defaults to the Properties tab (renders Properties body, not Settings)', () => {
    render(<Sidebar />);
    expect(screen.getByText(/select a node to edit/i)).toBeInTheDocument();
    expect(screen.queryByText('Node Color')).toBeNull();
    expect(screen.queryByText('Theme')).toBeNull();
  });

  it('clicking Settings tab swaps body to Settings content', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('tab', { name: /settings/i }));
    expect(screen.getByText('Node Color')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Grid Background')).toBeInTheDocument();
    // Properties body is hidden.
    expect(screen.queryByText(/select a node to edit/i)).toBeNull();
  });

  it('aria-selected reflects active tab', () => {
    render(<Sidebar />);
    const properties = screen.getByRole('tab', { name: /properties/i });
    const settings = screen.getByRole('tab', { name: /settings/i });
    expect(properties.getAttribute('aria-selected')).toBe('true');
    expect(settings.getAttribute('aria-selected')).toBe('false');
    fireEvent.click(settings);
    expect(properties.getAttribute('aria-selected')).toBe('false');
    expect(settings.getAttribute('aria-selected')).toBe('true');
  });
});
