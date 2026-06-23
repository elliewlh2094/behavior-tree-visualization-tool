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
    dirty: false,
    lastSavedDocument: document,
  });
}

describe('bt-store dirty tracking (FR9)', () => {
  beforeEach(reset);

  it('starts clean', () => {
    expect(useBTStore.getState().dirty).toBe(false);
  });

  it('a mutating action sets dirty true', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    expect(useBTStore.getState().dirty).toBe(true);
  });

  it('a no-op action keeps dirty false', () => {
    // duplicateSelection with an empty selection short-circuits to `return {}`,
    // preserving the document reference — so dirty must stay false (decision #8:
    // a no-op must not falsely mark the document unsaved).
    expect(useBTStore.getState().selection).toBe(EMPTY_SELECTION);
    useBTStore.getState().duplicateSelection();
    expect(useBTStore.getState().dirty).toBe(false);
  });

  it('setDocument clears dirty and re-baselines', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    expect(useBTStore.getState().dirty).toBe(true);
    const fresh = createEmptyDocument();
    useBTStore.getState().setDocument(fresh);
    expect(useBTStore.getState().dirty).toBe(false);
    expect(useBTStore.getState().lastSavedDocument).toBe(fresh);
  });

  it('markSaved clears dirty against the current document', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    expect(useBTStore.getState().dirty).toBe(true);
    useBTStore.getState().markSaved();
    expect(useBTStore.getState().dirty).toBe(false);
    expect(useBTStore.getState().lastSavedDocument).toBe(
      useBTStore.getState().document,
    );
  });

  it('mutating after a save sets dirty again', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    useBTStore.getState().markSaved();
    expect(useBTStore.getState().dirty).toBe(false);
    useBTStore.getState().addNode('Fallback', { x: 50, y: 50 });
    expect(useBTStore.getState().dirty).toBe(true);
  });

  it('dirty and lastSavedDocument are not part of DocSnapshot', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    const snap = useBTStore.getState().undoStack.items[0]!;
    expect(Object.keys(snap).sort()).toEqual(['activeTreeId', 'document']);
  });
});
