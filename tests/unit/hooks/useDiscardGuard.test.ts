import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDiscardGuard } from '../../../src/hooks/useDiscardGuard';
import { useBTStore } from '../../../src/store/bt-store';
import { createEmptyDocument } from '../../../src/core/model/tree';

const COPY = {
  title: 'Discard unsaved changes?',
  message: '…',
  confirmLabel: 'Discard & open',
  cancelLabel: 'Cancel',
};

// Distinct document/lastSavedDocument refs → store-level subscription sets dirty.
function setDirty(dirty: boolean) {
  const doc = createEmptyDocument();
  useBTStore.setState({
    document: doc,
    activeTreeId: doc.mainTreeId,
    lastSavedDocument: dirty ? createEmptyDocument() : doc,
  });
}

describe('useDiscardGuard (AD10)', () => {
  beforeEach(() => setDirty(false));

  it('runs the action immediately and sets no pending state when clean', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useDiscardGuard());

    act(() => result.current.requestDiscard(action, COPY));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeNull();
  });

  it('defers the action behind a pending confirmation when dirty', () => {
    setDirty(true);
    const action = vi.fn();
    const { result } = renderHook(() => useDiscardGuard());

    act(() => result.current.requestDiscard(action, COPY));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.pending?.copy).toEqual(COPY);
  });

  it('confirm runs the deferred action and clears pending', () => {
    setDirty(true);
    const action = vi.fn();
    const { result } = renderHook(() => useDiscardGuard());

    act(() => result.current.requestDiscard(action, COPY));
    act(() => result.current.confirm());

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeNull();
  });

  it('cancel clears pending without running the action', () => {
    setDirty(true);
    const action = vi.fn();
    const { result } = renderHook(() => useDiscardGuard());

    act(() => result.current.requestDiscard(action, COPY));
    act(() => result.current.cancel());

    expect(action).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });
});
