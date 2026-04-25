import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyTree } from '../../../src/core/model/tree';
import {
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  useBTStore,
} from '../../../src/store/bt-store';

function reset(): void {
  useBTStore.setState({
    tree: createEmptyTree(),
    selection: EMPTY_SELECTION,
    undoStack: { capacity: HISTORY_CAPACITY, items: [] },
    redoStack: { capacity: HISTORY_CAPACITY, items: [] },
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

  it('setTree resets fileName to "Untitled.json"', () => {
    useBTStore.getState().setFileName('my-tree.json');
    expect(useBTStore.getState().fileName).toBe('my-tree.json');

    useBTStore.getState().setTree(createEmptyTree());
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
