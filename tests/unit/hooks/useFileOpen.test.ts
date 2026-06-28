import { describe, expect, it, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileOpen } from '../../../src/hooks/useFileOpen';

describe('useFileOpen.triggerOpen (AD10: guard moved to caller)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens the file picker without any unsaved-changes prompt of its own', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { result } = renderHook(() => useFileOpen());

    const input = document.createElement('input');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    // The hook types fileInputRef as read-only; assign through a mutable view.
    (result.current.fileInputRef as { current: HTMLInputElement | null }).current =
      input;

    result.current.triggerOpen();

    // The dirty guard now lives at the Toolbar call site (requestDiscard), not
    // here — triggerOpen just opens the picker.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });
});
