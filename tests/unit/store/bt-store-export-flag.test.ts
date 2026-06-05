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
  });
}

describe('bt-store exportInProgress flag', () => {
  beforeEach(reset);

  it('initializes to null', () => {
    expect(useBTStore.getState().exportInProgress).toBeNull();
  });

  it('setExportInProgress sets the mode', () => {
    useBTStore.getState().setExportInProgress('transparent');
    expect(useBTStore.getState().exportInProgress).toBe('transparent');
    useBTStore.getState().setExportInProgress('themed');
    expect(useBTStore.getState().exportInProgress).toBe('themed');
    useBTStore.getState().setExportInProgress(null);
    expect(useBTStore.getState().exportInProgress).toBeNull();
  });

  it('setExportInProgress does not push history', () => {
    const before = useBTStore.getState().undoStack;
    useBTStore.getState().setExportInProgress('themed');
    expect(useBTStore.getState().undoStack).toBe(before);
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
  });

  it('undo and redo do not touch the flag', () => {
    // Make one undoable action so undo/redo have something to operate on.
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    useBTStore.getState().setExportInProgress('transparent');

    useBTStore.getState().undo();
    expect(useBTStore.getState().exportInProgress).toBe('transparent');

    useBTStore.getState().redo();
    expect(useBTStore.getState().exportInProgress).toBe('transparent');
  });

  it('setDocument does not touch the flag', () => {
    useBTStore.getState().setExportInProgress('themed');
    useBTStore.getState().setDocument(createEmptyDocument());
    expect(useBTStore.getState().exportInProgress).toBe('themed');
  });

  it('is not part of DocSnapshot (snapshot has only document + activeTreeId)', () => {
    useBTStore.getState().setExportInProgress('transparent');
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    const snap = useBTStore.getState().undoStack.items[0]!;
    expect(Object.keys(snap).sort()).toEqual(['activeTreeId', 'document']);
  });
});
