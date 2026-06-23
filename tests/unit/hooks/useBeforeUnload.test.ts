import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBeforeUnload } from '../../../src/hooks/useBeforeUnload';

// Dispatches a cancelable beforeunload event and reports whether a listener
// called preventDefault (return false from dispatchEvent = default prevented).
function fireBeforeUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  return window.dispatchEvent(event);
}

describe('useBeforeUnload (FR9)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not attach a listener when disabled', () => {
    renderHook(() => useBeforeUnload(false));
    // No listener → nobody preventDefaults → dispatch returns true.
    expect(fireBeforeUnload()).toBe(true);
  });

  it('prevents unload when enabled', () => {
    renderHook(() => useBeforeUnload(true));
    expect(fireBeforeUnload()).toBe(false);
  });

  it('detaches the listener on unmount', () => {
    const { unmount } = renderHook(() => useBeforeUnload(true));
    expect(fireBeforeUnload()).toBe(false);
    unmount();
    expect(fireBeforeUnload()).toBe(true);
  });

  it('detaches when toggled from enabled to disabled', () => {
    const { rerender } = renderHook(({ on }) => useBeforeUnload(on), {
      initialProps: { on: true },
    });
    expect(fireBeforeUnload()).toBe(false);
    rerender({ on: false });
    expect(fireBeforeUnload()).toBe(true);
  });
});
