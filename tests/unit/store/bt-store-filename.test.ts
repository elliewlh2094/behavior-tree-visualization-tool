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
    fileName: 'Untitled.json',
  });
}

describe('bt-store fileName', () => {
  beforeEach(reset);

  it('initial fileName is "Untitled.json"', () => {
    expect(useBTStore.getState().fileName).toBe('Untitled.json');
  });

  it('setFileName updates the value', () => {
    useBTStore.getState().setFileName('foo.json');
    expect(useBTStore.getState().fileName).toBe('foo.json');
  });

  it('setDocument resets fileName to "Untitled.json"', () => {
    useBTStore.getState().setFileName('my-tree.json');
    expect(useBTStore.getState().fileName).toBe('my-tree.json');

    useBTStore.getState().setDocument(createEmptyDocument());
    expect(useBTStore.getState().fileName).toBe('Untitled.json');
  });

  it('undo after setFileName does not revert the file name', () => {
    // Perform an undoable action so there is something on the undo stack
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });

    // Change the file name (not part of history)
    useBTStore.getState().setFileName('renamed.json');

    // Undo the addNode — fileName should remain unchanged
    useBTStore.getState().undo();
    expect(useBTStore.getState().fileName).toBe('renamed.json');
  });
});
