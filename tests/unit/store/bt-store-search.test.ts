import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../../../src/core/model/tree';
import {
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  useBTStore,
  type DocSnapshot,
} from '../../../src/store/bt-store';
import { createRingBuffer } from '../../../src/core/history/ring-buffer';

function reset(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    selection: EMPTY_SELECTION,
    undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    viewportByTreeId: {},
    exportInProgress: null,
    searchOpen: false,
    searchMatchIds: new Set(),
    searchCurrentId: null,
    dirty: false,
    lastSavedDocument: document,
  });
}

describe('bt-store search transient state (FR6)', () => {
  beforeEach(reset);

  it('starts closed with no matches', () => {
    expect(useBTStore.getState().searchOpen).toBe(false);
    expect(useBTStore.getState().searchMatchIds.size).toBe(0);
  });

  it('setSearchOpen toggles open', () => {
    useBTStore.getState().setSearchOpen(true);
    expect(useBTStore.getState().searchOpen).toBe(true);
  });

  it('closing search clears the match set and current id', () => {
    useBTStore.getState().setSearchOpen(true);
    useBTStore.getState().setSearchMatchIds(new Set(['a', 'b']));
    useBTStore.getState().setSearchCurrentId('a');
    expect(useBTStore.getState().searchMatchIds.size).toBe(2);
    expect(useBTStore.getState().searchCurrentId).toBe('a');
    useBTStore.getState().setSearchOpen(false);
    expect(useBTStore.getState().searchOpen).toBe(false);
    expect(useBTStore.getState().searchMatchIds.size).toBe(0);
    expect(useBTStore.getState().searchCurrentId).toBeNull();
  });

  it('toggling search creates no undo entry', () => {
    const before = useBTStore.getState().undoStack;
    useBTStore.getState().setSearchOpen(true);
    useBTStore.getState().setSearchMatchIds(new Set(['a']));
    useBTStore.getState().setSearchOpen(false);
    // Same ring-buffer reference = nothing was pushed (setters bypass withSnapshot).
    expect(useBTStore.getState().undoStack).toBe(before);
  });

  it('search state does not falsely mark the document dirty', () => {
    useBTStore.getState().setSearchOpen(true);
    useBTStore.getState().setSearchMatchIds(new Set(['a']));
    expect(useBTStore.getState().dirty).toBe(false);
  });
});
