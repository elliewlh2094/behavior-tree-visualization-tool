// v1.7 T2: cross-tree-mutation push behavior. Asserts that renameTree,
// addTree, and deleteTree push to globalUndoStack via withCrossTreeHistory
// and that the redo-invalidation invariant (decision 5) holds in both
// directions: a doc-level push clears every per-tree redo stack + global
// redo, and a per-tree push clears global redo. Undo/redo merging by max-
// seq is T3 and tested in T4.
import { beforeEach, describe, expect, it } from 'vitest';
import type { BTDocument, BTNode, BTTreeDef } from '../../../src/core/model/node';
import {
  EMPTY_SELECTION,
  type GlobalSnapshot,
  HISTORY_CAPACITY,
  useBTStore,
} from '../../../src/store/bt-store';
import { createRingBuffer, push } from '../../../src/core/history/ring-buffer';

function rootNode(id: string): BTNode {
  return { id, kind: 'Root', name: 'Root', position: { x: 0, y: 0 }, properties: {} };
}

function makeTree(opts: { id: string; name: string }): BTTreeDef {
  return {
    id: opts.id,
    name: opts.name,
    rootId: `${opts.id}-root`,
    nodes: [rootNode(`${opts.id}-root`)],
    connections: [],
  };
}

function install(document: BTDocument, activeTreeId: string): void {
  useBTStore.setState({
    document,
    activeTreeId,
    selection: EMPTY_SELECTION,
    undoStacks: {},
    redoStacks: {},
    globalUndoStack: createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY),
    globalRedoStack: createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY),
    historySeq: 0,
    viewportByTreeId: {},
  });
}

describe('cross-tree push: renameTree', () => {
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [makeTree({ id: 'main', name: 'Main' }), makeTree({ id: 'patrol', name: 'Patrol' })],
      },
      'main',
    );
  });

  it('captures the prev document and prev activeTreeId at push time', () => {
    const prevDocument = useBTStore.getState().document;

    useBTStore.getState().renameTree('patrol', 'Guard');

    const top = useBTStore.getState().globalUndoStack.items.at(-1)!;
    expect(top.document).toBe(prevDocument);
    expect(top.activeTreeId).toBe('main');
    expect(top.seq).toBe(1);
  });

  it('is a no-op when newName === oldName (no push)', () => {
    useBTStore.getState().renameTree('patrol', 'Patrol');

    expect(useBTStore.getState().globalUndoStack.items).toHaveLength(0);
    expect(useBTStore.getState().historySeq).toBe(0);
  });

  it('is a no-op for an unknown treeId (no push)', () => {
    useBTStore.getState().renameTree('does-not-exist', 'Whatever');

    expect(useBTStore.getState().globalUndoStack.items).toHaveLength(0);
  });
});

describe('cross-tree push: addTree', () => {
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [makeTree({ id: 'main', name: 'Main' })],
      },
      'main',
    );
  });

  it('captures prev activeTreeId before swapping to the newly created tree', () => {
    const prevDocument = useBTStore.getState().document;

    useBTStore.getState().addTree('Tree 2');

    const top = useBTStore.getState().globalUndoStack.items.at(-1)!;
    expect(top.document).toBe(prevDocument);
    // Pre-swap: 'main' was active when addTree fired.
    expect(top.activeTreeId).toBe('main');
    // Post-swap: state.activeTreeId is now the new tree.
    expect(useBTStore.getState().activeTreeId).not.toBe('main');
  });
});

describe('cross-tree push: deleteTree', () => {
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [
          makeTree({ id: 'main', name: 'Main' }),
          makeTree({ id: 'patrol', name: 'Patrol' }),
        ],
      },
      'patrol',
    );
  });

  it('captures the prev document including the to-be-deleted tree', () => {
    const prevDocument = useBTStore.getState().document;

    useBTStore.getState().deleteTree('patrol');

    const top = useBTStore.getState().globalUndoStack.items.at(-1)!;
    expect(top.document).toBe(prevDocument);
    expect(top.document.trees.some((t) => t.id === 'patrol')).toBe(true);
    expect(top.activeTreeId).toBe('patrol');
  });

  it('does not drop per-tree state for the deleted tree (decision 8)', () => {
    useBTStore.getState().beginGesture();
    const undoBefore = useBTStore.getState().undoStacks['patrol'];
    expect(undoBefore).toBeDefined();

    useBTStore.getState().deleteTree('patrol');

    expect(useBTStore.getState().undoStacks['patrol']).toBe(undoBefore);
  });

  it('is a no-op for the main tree (no push)', () => {
    useBTStore.getState().deleteTree('main');

    expect(useBTStore.getState().globalUndoStack.items).toHaveLength(0);
  });
});

describe('redo invalidation across stack types', () => {
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [makeTree({ id: 'main', name: 'Main' }), makeTree({ id: 'patrol', name: 'Patrol' })],
      },
      'main',
    );
  });

  it('a cross-tree push clears every per-tree redo stack', () => {
    // Seed both a 'main' and 'patrol' redo stack with a fake item via setState.
    useBTStore.setState({
      redoStacks: {
        main: push(createRingBuffer(HISTORY_CAPACITY), {
          seq: 99,
          tree: useBTStore.getState().document.trees[0]!,
        }),
        patrol: push(createRingBuffer(HISTORY_CAPACITY), {
          seq: 98,
          tree: useBTStore.getState().document.trees[1]!,
        }),
      },
    });
    expect(useBTStore.getState().redoStacks.main!.items).toHaveLength(1);
    expect(useBTStore.getState().redoStacks.patrol!.items).toHaveLength(1);

    useBTStore.getState().renameTree('patrol', 'Guard');

    expect(useBTStore.getState().redoStacks.main!.items).toHaveLength(0);
    expect(useBTStore.getState().redoStacks.patrol!.items).toHaveLength(0);
  });

  it('a cross-tree push clears the globalRedoStack', () => {
    useBTStore.setState({
      globalRedoStack: push(createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY), {
        seq: 99,
        document: useBTStore.getState().document,
        activeTreeId: 'main',
      }),
    });
    expect(useBTStore.getState().globalRedoStack.items).toHaveLength(1);

    useBTStore.getState().renameTree('patrol', 'Guard');

    expect(useBTStore.getState().globalRedoStack.items).toHaveLength(0);
  });

  it('a per-tree push clears the globalRedoStack', () => {
    useBTStore.setState({
      globalRedoStack: push(createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY), {
        seq: 99,
        document: useBTStore.getState().document,
        activeTreeId: 'main',
      }),
    });
    expect(useBTStore.getState().globalRedoStack.items).toHaveLength(1);

    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });

    expect(useBTStore.getState().globalRedoStack.items).toHaveLength(0);
  });

  it('a beginGesture push also clears the globalRedoStack', () => {
    useBTStore.setState({
      globalRedoStack: push(createRingBuffer<GlobalSnapshot>(HISTORY_CAPACITY), {
        seq: 99,
        document: useBTStore.getState().document,
        activeTreeId: 'main',
      }),
    });

    useBTStore.getState().beginGesture();

    expect(useBTStore.getState().globalRedoStack.items).toHaveLength(0);
  });
});

describe('historySeq monotonicity across stack types', () => {
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [makeTree({ id: 'main', name: 'Main' }), makeTree({ id: 'patrol', name: 'Patrol' })],
      },
      'main',
    );
  });

  it('per-tree push and cross-tree push share the same monotonic counter', () => {
    expect(useBTStore.getState().historySeq).toBe(0);

    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 }); // per-tree
    expect(useBTStore.getState().historySeq).toBe(1);

    useBTStore.getState().renameTree('patrol', 'Guard'); // cross-tree
    expect(useBTStore.getState().historySeq).toBe(2);

    useBTStore.getState().addNode('Fallback', { x: 10, y: 10 }); // per-tree
    expect(useBTStore.getState().historySeq).toBe(3);

    // Stack tops carry their seq tags.
    const main = useBTStore.getState().undoStacks.main!;
    expect(main.items.at(-1)!.seq).toBe(3);
    const global = useBTStore.getState().globalUndoStack;
    expect(global.items.at(-1)!.seq).toBe(2);
  });
});
