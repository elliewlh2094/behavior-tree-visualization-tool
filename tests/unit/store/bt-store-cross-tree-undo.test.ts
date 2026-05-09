// v1.7 T2/T4: cross-tree mutation undo/redo. T2 added the push side
// (renameTree/addTree/deleteTree → globalUndoStack via withCrossTreeHistory)
// + the redo-invalidation invariant. T4 covers the merged undo/redo (max-seq
// across per-tree + global stacks) end-to-end at the store level: happy
// paths, interleaving, round-trip, eviction, stack-empty edges, and the
// selection-cleared invariant.
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

function subtreeNode(id: string, treeRef: string, name = treeRef): BTNode {
  return {
    id,
    kind: 'SubTree',
    name,
    position: { x: 0, y: 0 },
    properties: {},
    treeRef,
  };
}

function makeTree(opts: {
  id: string;
  name: string;
  extraNodes?: readonly BTNode[];
}): BTTreeDef {
  return {
    id: opts.id,
    name: opts.name,
    rootId: `${opts.id}-root`,
    nodes: [rootNode(`${opts.id}-root`), ...(opts.extraNodes ?? [])],
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

// =============================================================================
// T4: merged undo/redo by max-seq — the user-visible bug fix
// =============================================================================

function getTree(id: string): BTTreeDef {
  return useBTStore.getState().document.trees.find((t) => t.id === id)!;
}

describe('merged undo: cross-tree happy paths', () => {
  it('renameTree + undo restores tree name and SubTree nodes that referenced it', () => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [
          makeTree({ id: 'main', name: 'Main', extraNodes: [subtreeNode('s1', 'Patrol')] }),
          makeTree({ id: 'patrol', name: 'Patrol' }),
        ],
      },
      'main',
    );

    useBTStore.getState().renameTree('patrol', 'Guard');
    expect(getTree('patrol').name).toBe('Guard');
    const subAfter = getTree('main').nodes.find((n) => n.id === 's1')!;
    expect(subAfter.name).toBe('Guard');
    expect((subAfter as { treeRef?: string }).treeRef).toBe('Guard');

    useBTStore.getState().undo();

    expect(getTree('patrol').name).toBe('Patrol');
    const subRestored = getTree('main').nodes.find((n) => n.id === 's1')!;
    expect(subRestored.name).toBe('Patrol');
    expect((subRestored as { treeRef?: string }).treeRef).toBe('Patrol');
  });

  it('addTree + undo removes the new tree and restores activeTreeId to pre-add', () => {
    install(
      { version: 2, mainTreeId: 'main', trees: [makeTree({ id: 'main', name: 'Main' })] },
      'main',
    );

    useBTStore.getState().addTree('Tree 2');
    expect(useBTStore.getState().document.trees).toHaveLength(2);
    expect(useBTStore.getState().activeTreeId).not.toBe('main');

    useBTStore.getState().undo();

    expect(useBTStore.getState().document.trees).toHaveLength(1);
    expect(useBTStore.getState().activeTreeId).toBe('main');
  });

  it('deleteTree + undo restores the tree, re-activates it, and preserves per-tree state', () => {
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
    // Seed per-tree state on patrol so we can verify it survives delete+undo.
    useBTStore.getState().beginGesture();
    const undoBefore = useBTStore.getState().undoStacks.patrol!;
    expect(undoBefore.items).toHaveLength(1);

    useBTStore.getState().deleteTree('patrol');
    expect(useBTStore.getState().document.trees.some((t) => t.id === 'patrol')).toBe(false);
    expect(useBTStore.getState().activeTreeId).toBe('main');

    useBTStore.getState().undo();

    expect(useBTStore.getState().document.trees.some((t) => t.id === 'patrol')).toBe(true);
    expect(useBTStore.getState().activeTreeId).toBe('patrol');
    // Per-tree state intact through round-trip (decision 8).
    expect(useBTStore.getState().undoStacks.patrol).toBe(undoBefore);
  });
});

describe('merged undo: interleaving + round-trip', () => {
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
      'main',
    );
  });

  it('interleaved per-tree + cross-tree actions undo in reverse-time order regardless of active tab', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 }); // seq=1, local on main
    useBTStore.getState().renameTree('patrol', 'Guard'); // seq=2, global
    useBTStore.getState().addNode('Fallback', { x: 10, y: 10 }); // seq=3, local on main

    // Undo 1: pops local seq=3 — Fallback gone, but Patrol still renamed.
    useBTStore.getState().undo();
    expect(getTree('main').nodes.some((n) => n.kind === 'Fallback')).toBe(false);
    expect(getTree('main').nodes.some((n) => n.kind === 'Sequence')).toBe(true);
    expect(getTree('patrol').name).toBe('Guard');

    // Undo 2: pops global seq=2 — rename reverts; Sequence still on main.
    useBTStore.getState().undo();
    expect(getTree('patrol').name).toBe('Patrol');
    expect(getTree('main').nodes.some((n) => n.kind === 'Sequence')).toBe(true);

    // Undo 3: pops local seq=1 — Sequence gone.
    useBTStore.getState().undo();
    expect(getTree('main').nodes.some((n) => n.kind === 'Sequence')).toBe(false);
    expect(getTree('patrol').name).toBe('Patrol');
  });

  it('cross-tree round-trip: rename → undo → redo → undo lands on the alternating doc states', () => {
    useBTStore.getState().renameTree('patrol', 'Guard');
    expect(getTree('patrol').name).toBe('Guard');

    useBTStore.getState().undo();
    expect(getTree('patrol').name).toBe('Patrol');

    useBTStore.getState().redo();
    expect(getTree('patrol').name).toBe('Guard');

    useBTStore.getState().undo();
    expect(getTree('patrol').name).toBe('Patrol');
  });

  it('redo replays cross-tree actions interleaved with per-tree actions in time order', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 }); // seq=1, local
    useBTStore.getState().renameTree('patrol', 'Guard'); // seq=2, global
    useBTStore.getState().addNode('Fallback', { x: 10, y: 10 }); // seq=3, local

    // Walk all the way back.
    useBTStore.getState().undo();
    useBTStore.getState().undo();
    useBTStore.getState().undo();
    expect(getTree('main').nodes.some((n) => n.kind === 'Sequence')).toBe(false);
    expect(getTree('main').nodes.some((n) => n.kind === 'Fallback')).toBe(false);
    expect(getTree('patrol').name).toBe('Patrol');

    // Walk all the way forward — same chronological order.
    useBTStore.getState().redo();
    expect(getTree('main').nodes.some((n) => n.kind === 'Sequence')).toBe(true);
    expect(getTree('patrol').name).toBe('Patrol');

    useBTStore.getState().redo();
    expect(getTree('patrol').name).toBe('Guard');
    expect(getTree('main').nodes.some((n) => n.kind === 'Fallback')).toBe(false);

    useBTStore.getState().redo();
    expect(getTree('main').nodes.some((n) => n.kind === 'Fallback')).toBe(true);
    expect(getTree('patrol').name).toBe('Guard');
  });
});

describe('merged undo: stack-empty edge cases', () => {
  it('undo with both stacks empty is a no-op (document and historySeq unchanged)', () => {
    install(
      { version: 2, mainTreeId: 'main', trees: [makeTree({ id: 'main', name: 'Main' })] },
      'main',
    );
    const beforeDoc = useBTStore.getState().document;
    const beforeSeq = useBTStore.getState().historySeq;

    useBTStore.getState().undo();

    expect(useBTStore.getState().document).toBe(beforeDoc);
    expect(useBTStore.getState().historySeq).toBe(beforeSeq);
  });

  it('redo with both stacks empty is a no-op', () => {
    install(
      { version: 2, mainTreeId: 'main', trees: [makeTree({ id: 'main', name: 'Main' })] },
      'main',
    );
    const beforeDoc = useBTStore.getState().document;

    useBTStore.getState().redo();

    expect(useBTStore.getState().document).toBe(beforeDoc);
  });

  it('undo with only local non-empty pops local (v1.4 baseline preserved)', () => {
    install(
      { version: 2, mainTreeId: 'main', trees: [makeTree({ id: 'main', name: 'Main' })] },
      'main',
    );
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    expect(getTree('main').nodes.some((n) => n.kind === 'Sequence')).toBe(true);

    useBTStore.getState().undo();

    expect(getTree('main').nodes.some((n) => n.kind === 'Sequence')).toBe(false);
  });

  it('undo with only global non-empty pops global', () => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [
          makeTree({ id: 'main', name: 'Main' }),
          makeTree({ id: 'patrol', name: 'Patrol' }),
        ],
      },
      'main',
    );
    useBTStore.getState().renameTree('patrol', 'Guard');

    useBTStore.getState().undo();

    expect(getTree('patrol').name).toBe('Patrol');
  });
});

describe('merged undo: eviction', () => {
  it('per-tree eviction leaves global pop reachable; pop order is by seq, not by stack', () => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [
          makeTree({ id: 'main', name: 'Main' }),
          makeTree({ id: 'patrol', name: 'Patrol' }),
        ],
      },
      'main',
    );

    // HISTORY_CAPACITY per-tree pushes (seqs 1..HISTORY_CAPACITY).
    for (let i = 0; i < HISTORY_CAPACITY; i++) {
      useBTStore.getState().addNode('Sequence', { x: i, y: 0 });
    }
    // One cross-tree push (seq HISTORY_CAPACITY+1).
    useBTStore.getState().renameTree('patrol', 'Guard');

    expect(useBTStore.getState().undoStacks.main!.items).toHaveLength(HISTORY_CAPACITY);
    expect(useBTStore.getState().globalUndoStack.items).toHaveLength(1);

    // First undo: global wins (highest seq).
    useBTStore.getState().undo();
    expect(getTree('patrol').name).toBe('Patrol');
    expect(useBTStore.getState().globalUndoStack.items).toHaveLength(0);

    // Next HISTORY_CAPACITY undos: pop the per-tree stack.
    for (let i = 0; i < HISTORY_CAPACITY; i++) {
      useBTStore.getState().undo();
    }
    expect(useBTStore.getState().undoStacks.main!.items).toHaveLength(0);
    // After all HISTORY_CAPACITY pops, only the Root remains on main.
    expect(getTree('main').nodes).toHaveLength(1);

    // Both stacks empty now → no-op.
    const beforeNoop = useBTStore.getState().document;
    useBTStore.getState().undo();
    expect(useBTStore.getState().document).toBe(beforeNoop);
  });
});

describe('merged undo: selection clearing', () => {
  it('cross-tree undo clears any prior selection (matches v1.4 per-tree-undo behavior)', () => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [
          makeTree({ id: 'main', name: 'Main' }),
          makeTree({ id: 'patrol', name: 'Patrol' }),
        ],
      },
      'main',
    );
    useBTStore.getState().renameTree('patrol', 'Guard');
    useBTStore.setState({
      selection: { nodeIds: new Set(['main-root']), edgeIds: new Set() },
    });

    useBTStore.getState().undo();

    expect(useBTStore.getState().selection).toBe(EMPTY_SELECTION);
  });
});
