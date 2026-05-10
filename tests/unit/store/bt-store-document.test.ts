import { beforeEach, describe, expect, it } from 'vitest';
import type { BTDocument, BTNode, BTTreeDef } from '../../../src/core/model/node';
import {
  type DocSnapshot,
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  selectActiveTree,
  selectViewport,
  useBTStore,
} from '../../../src/store/bt-store';
import { createRingBuffer } from '../../../src/core/history/ring-buffer';

function rootNode(id: string): BTNode {
  return { id, kind: 'Root', name: 'Root', position: { x: 0, y: 0 }, properties: {} };
}

function makeTree(opts: {
  id: string;
  name: string;
  extraNodes?: readonly BTNode[];
}): BTTreeDef {
  const rootId = `${opts.id}-root`;
  return {
    id: opts.id,
    name: opts.name,
    rootId,
    nodes: [rootNode(rootId), ...(opts.extraNodes ?? [])],
    connections: [],
  };
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

describe('bt-store addTree', () => {
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

  it('appends a new tree with a single Root and no connections', () => {
    useBTStore.getState().addTree('Tree 2');

    const trees = useBTStore.getState().document.trees;
    expect(trees).toHaveLength(2);
    const created = trees[1]!;
    expect(created.name).toBe('Tree 2');
    expect(created.nodes).toHaveLength(1);
    expect(created.nodes[0]!.kind).toBe('Root');
    expect(created.rootId).toBe(created.nodes[0]!.id);
    expect(created.connections).toEqual([]);
  });

  it('makes the newly created tree active and clears any selection', () => {
    useBTStore.setState({
      selection: { nodeIds: new Set(['some-id']), edgeIds: new Set() },
    });

    useBTStore.getState().addTree('Tree 2');

    const state = useBTStore.getState();
    const created = state.document.trees[1]!;
    expect(state.activeTreeId).toBe(created.id);
    expect(state.selection).toBe(EMPTY_SELECTION);
  });

  it('does not modify existing trees', () => {
    const before = useBTStore.getState().document.trees[0]!;

    useBTStore.getState().addTree('Tree 2');

    const after = useBTStore.getState().document.trees[0]!;
    expect(after).toBe(before);
  });

  it('uses a fresh, unique tree id per call', () => {
    useBTStore.getState().addTree('Tree 2');
    useBTStore.getState().addTree('Tree 3');

    const trees = useBTStore.getState().document.trees;
    const ids = new Set(trees.map((t) => t.id));
    expect(ids.size).toBe(trees.length);
  });

  it('pushes a snapshot of the pre-action document and activeTreeId (v1.7.1)', () => {
    const prevDocument = useBTStore.getState().document;
    const prevActiveTreeId = useBTStore.getState().activeTreeId;

    useBTStore.getState().addTree('Tree 2');

    const { undoStack } = useBTStore.getState();
    expect(undoStack.items).toHaveLength(1);
    expect(undoStack.items[0]!.document).toBe(prevDocument);
    expect(undoStack.items[0]!.activeTreeId).toBe(prevActiveTreeId);
  });
});

describe('bt-store deleteTree', () => {
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [
          makeTree({ id: 'main', name: 'Main' }),
          makeTree({ id: 'patrol', name: 'Patrol' }),
          makeTree({ id: 'combat', name: 'Combat' }),
        ],
      },
      'patrol',
    );
  });

  it('removes the target tree from the document', () => {
    useBTStore.getState().deleteTree('combat');

    const ids = useBTStore.getState().document.trees.map((t) => t.id);
    expect(ids).toEqual(['main', 'patrol']);
  });

  it('refuses to delete the main tree (no-op)', () => {
    const before = useBTStore.getState().document;

    useBTStore.getState().deleteTree('main');

    expect(useBTStore.getState().document).toBe(before);
  });

  it('is a no-op for an unknown treeId', () => {
    const before = useBTStore.getState().document;

    useBTStore.getState().deleteTree('does-not-exist');

    expect(useBTStore.getState().document).toBe(before);
  });

  it('switches active to main and clears selection when the deleted tree was active', () => {
    useBTStore.setState({
      selection: { nodeIds: new Set(['patrol-root']), edgeIds: new Set() },
    });

    useBTStore.getState().deleteTree('patrol');

    const state = useBTStore.getState();
    expect(state.activeTreeId).toBe('main');
    expect(state.selection).toBe(EMPTY_SELECTION);
  });

  it('leaves activeTreeId and selection alone when deleting a non-active tree', () => {
    const selection = { nodeIds: new Set(['patrol-root']), edgeIds: new Set<string>() };
    useBTStore.setState({ selection });

    useBTStore.getState().deleteTree('combat');

    const state = useBTStore.getState();
    expect(state.activeTreeId).toBe('patrol');
    expect(state.selection).toBe(selection);
  });

  it('preserves per-tree viewport for the deleted tree (undo can restore it intact)', () => {
    // History is doc-level (v1.7.1) so it always covers the deleted tree
    // in its snapshot. Only viewport is keyed per-tree, and we keep it so
    // the undone delete restores the tab to the same pan/zoom.
    useBTStore.getState().setViewport('combat', { x: 100, y: 200, zoom: 2 });
    const viewportBefore = useBTStore.getState().viewportByTreeId['combat'];
    expect(viewportBefore).toBeDefined();

    useBTStore.getState().deleteTree('combat');

    const state = useBTStore.getState();
    expect(state.viewportByTreeId['combat']).toBe(viewportBefore);
  });

  it('pushes a snapshot of the pre-action document and activeTreeId (v1.7.1)', () => {
    const prevDocument = useBTStore.getState().document;
    const prevActiveTreeId = useBTStore.getState().activeTreeId;

    useBTStore.getState().deleteTree('combat');

    const { undoStack } = useBTStore.getState();
    expect(undoStack.items).toHaveLength(1);
    expect(undoStack.items[0]!.document).toBe(prevDocument);
    expect(undoStack.items[0]!.activeTreeId).toBe(prevActiveTreeId);
  });
});

describe('bt-store updateNodeTreeRef', () => {
  // SubTree identity invariant from T9: when a treeRef is picked, the node's
  // `name` snaps to the referenced tree's `name`. When the referenced tree
  // doesn't exist, only treeRef is set and `name` is left untouched.
  beforeEach(() => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [
          makeTree({
            id: 'main',
            name: 'Main',
            extraNodes: [
              {
                id: 's1',
                kind: 'SubTree',
                name: '',
                position: { x: 0, y: 0 },
                properties: {},
              },
            ],
          }),
          makeTree({ id: 'patrol', name: 'Patrol' }),
        ],
      },
      'main',
    );
  });

  it('sets treeRef and syncs node.name when the referenced tree exists', () => {
    useBTStore.getState().updateNodeTreeRef('s1', 'Patrol');

    const node = selectActiveTree(useBTStore.getState()).nodes.find((n) => n.id === 's1')!;
    expect(node.treeRef).toBe('Patrol');
    expect(node.name).toBe('Patrol');
  });

  it('sets treeRef but leaves node.name alone when the referenced tree is unknown', () => {
    useBTStore.setState((s) => ({
      document: {
        ...s.document,
        trees: s.document.trees.map((t) =>
          t.id === 'main'
            ? {
                ...t,
                nodes: t.nodes.map((n) =>
                  n.id === 's1' ? { ...n, name: 'kept' } : n,
                ),
              }
            : t,
        ),
      },
    }));

    useBTStore.getState().updateNodeTreeRef('s1', 'NotARealTree');

    const node = selectActiveTree(useBTStore.getState()).nodes.find((n) => n.id === 's1')!;
    expect(node.treeRef).toBe('NotARealTree');
    expect(node.name).toBe('kept');
  });

  it('pushes one snapshot to the unified undoStack', () => {
    useBTStore.getState().updateNodeTreeRef('s1', 'Patrol');

    expect(useBTStore.getState().undoStack.items.length).toBe(1);
  });
});

describe('bt-store setDocument', () => {
  it('resets activeTreeId to the new document\'s mainTreeId', () => {
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

    const next: BTDocument = {
      version: 2,
      mainTreeId: 'fresh',
      trees: [makeTree({ id: 'fresh', name: 'Fresh' })],
    };
    useBTStore.getState().setDocument(next);

    expect(useBTStore.getState().activeTreeId).toBe('fresh');
  });

  it('clears selection, history, viewports, and resets fileName', () => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [makeTree({ id: 'main', name: 'Main' })],
      },
      'main',
    );
    useBTStore.setState({
      selection: { nodeIds: new Set(['x']), edgeIds: new Set() },
      viewportByTreeId: { main: { x: 1, y: 2, zoom: 1.5 } },
      fileName: 'previous.json',
    });
    useBTStore.getState().beginGesture();
    expect(useBTStore.getState().undoStack.items.length).toBe(1);

    useBTStore.getState().setDocument({
      version: 2,
      mainTreeId: 'new',
      trees: [makeTree({ id: 'new', name: 'New' })],
    });

    const state = useBTStore.getState();
    expect(state.selection).toBe(EMPTY_SELECTION);
    expect(state.undoStack.items).toEqual([]);
    expect(state.redoStack.items).toEqual([]);
    expect(state.viewportByTreeId).toEqual({});
    expect(state.fileName).toBe('Untitled.json');
  });
});

describe('bt-store mutations are scoped to the active tree', () => {
  it('addNode appends to the active tree only', () => {
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
    const mainBefore = useBTStore.getState().document.trees.find((t) => t.id === 'main')!;

    useBTStore.getState().addNode('Sequence', { x: 50, y: 50 });

    const state = useBTStore.getState();
    const main = state.document.trees.find((t) => t.id === 'main')!;
    const patrol = state.document.trees.find((t) => t.id === 'patrol')!;
    expect(main).toBe(mainBefore); // unchanged reference: scoped mutation
    expect(patrol.nodes).toHaveLength(2);
    expect(patrol.nodes[1]!.kind).toBe('Sequence');
  });

  it('selectActiveTree returns the tree matching activeTreeId', () => {
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

    expect(selectActiveTree(useBTStore.getState()).id).toBe('patrol');
    useBTStore.getState().setActiveTreeId('main');
    expect(selectActiveTree(useBTStore.getState()).id).toBe('main');
  });

  it('selectViewport falls back to the default for unvisited trees', () => {
    install(
      {
        version: 2,
        mainTreeId: 'main',
        trees: [makeTree({ id: 'main', name: 'Main' })],
      },
      'main',
    );

    const vp = selectViewport(useBTStore.getState(), 'main');
    expect(vp).toEqual({ x: 0, y: 0, zoom: 1 });
  });
});

describe('bt-store HISTORY_CAPACITY', () => {
  // Sanity-anchor: the unified history stack uses this cap; if it changes,
  // the ring-buffer eviction tests in bt-store-history.test.ts and the
  // round-trip tests in bt-store-cross-tree-undo.test.ts depend on it.
  it('is exported and is a positive integer', () => {
    expect(Number.isInteger(HISTORY_CAPACITY)).toBe(true);
    expect(HISTORY_CAPACITY).toBeGreaterThan(0);
  });
});
