import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BTDocument, BTNode, BTTreeDef } from '../../../src/core/model/node';
import {
  type DocSnapshot,
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  useBTStore,
} from '../../../src/store/bt-store';
import { createRingBuffer } from '../../../src/core/history/ring-buffer';

function rootNode(id: string): BTNode {
  return { id, kind: 'Root', name: '', position: { x: 0, y: 0 }, properties: {} };
}

function makeTree(id: string, name: string): BTTreeDef {
  const rootId = `${id}-root`;
  return { id, name, rootId, nodes: [rootNode(rootId)], connections: [] };
}

function install(document: BTDocument, activeTreeId: string): void {
  useBTStore.setState({
    document,
    activeTreeId,
    selection: EMPTY_SELECTION,
    undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    viewportByTreeId: {},
  });
}

describe('bt-store reorderTrees', () => {
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'a',
        trees: [makeTree('a', 'A'), makeTree('b', 'B'), makeTree('c', 'C')],
      },
      'a',
    );
  });

  it('replaces document.trees order to match orderedIds', () => {
    useBTStore.getState().reorderTrees(['c', 'a', 'b']);

    const ids = useBTStore.getState().document.trees.map((t) => t.id);
    expect(ids).toEqual(['c', 'a', 'b']);
  });

  it('preserves the original BTTreeDef references (no copies)', () => {
    const before = useBTStore.getState().document.trees;
    const refById = new Map(before.map((t) => [t.id, t]));

    useBTStore.getState().reorderTrees(['b', 'c', 'a']);

    for (const t of useBTStore.getState().document.trees) {
      expect(t).toBe(refById.get(t.id));
    }
  });

  it('leaves activeTreeId unchanged', () => {
    useBTStore.getState().reorderTrees(['c', 'b', 'a']);
    expect(useBTStore.getState().activeTreeId).toBe('a');
  });

  it('pushes a snapshot of the pre-action document and activeTreeId', () => {
    const prevDocument = useBTStore.getState().document;

    useBTStore.getState().reorderTrees(['c', 'a', 'b']);

    const { undoStack } = useBTStore.getState();
    expect(undoStack.items).toHaveLength(1);
    expect(undoStack.items[0]!.document).toBe(prevDocument);
    expect(undoStack.items[0]!.activeTreeId).toBe('a');
  });

  it('is a no-op when the requested order matches current order (new array ref)', () => {
    const before = useBTStore.getState().document;

    // Fresh array, identical element order — React/DnD hands back new refs.
    useBTStore.getState().reorderTrees(['a', 'b', 'c']);

    expect(useBTStore.getState().document).toBe(before);
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
  });

  it('bails (no change, no snapshot) on length mismatch', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = useBTStore.getState().document;

    useBTStore.getState().reorderTrees(['a', 'b']);

    expect(useBTStore.getState().document).toBe(before);
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('bails (no change, no snapshot) when orderedIds contents do not match tree ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = useBTStore.getState().document;

    useBTStore.getState().reorderTrees(['a', 'b', 'z']);

    expect(useBTStore.getState().document).toBe(before);
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
