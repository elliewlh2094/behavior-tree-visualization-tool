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
    showGrid: true,
  });
}

describe('bt-store showGrid', () => {
  beforeEach(reset);

  it('initial value is true', () => {
    expect(useBTStore.getState().showGrid).toBe(true);
  });

  it('toggleGrid flips the value', () => {
    useBTStore.getState().toggleGrid();
    expect(useBTStore.getState().showGrid).toBe(false);
    useBTStore.getState().toggleGrid();
    expect(useBTStore.getState().showGrid).toBe(true);
  });

  it('setTree preserves showGrid when grid is hidden', () => {
    useBTStore.getState().toggleGrid();
    expect(useBTStore.getState().showGrid).toBe(false);
    useBTStore.getState().setTree(createEmptyTree());
    expect(useBTStore.getState().showGrid).toBe(false);
  });

  it('setTree preserves showGrid when grid is visible', () => {
    expect(useBTStore.getState().showGrid).toBe(true);
    useBTStore.getState().setTree(createEmptyTree());
    expect(useBTStore.getState().showGrid).toBe(true);
  });

  it('undo after toggleGrid does not revert grid state', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    useBTStore.getState().toggleGrid();
    expect(useBTStore.getState().showGrid).toBe(false);
    useBTStore.getState().undo();
    expect(useBTStore.getState().showGrid).toBe(false);
  });
});
