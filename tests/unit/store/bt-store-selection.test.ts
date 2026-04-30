import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../../../src/core/model/tree';
import { addNode, connect } from '../../../src/core/model/operations';
import type { BTDocument, BTTreeDef } from '../../../src/core/model/node';
import {
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  selectActiveTree,
  useBTStore,
} from '../../../src/store/bt-store';

function reset(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    selection: EMPTY_SELECTION,
    undoStack: { capacity: HISTORY_CAPACITY, items: [] },
    redoStack: { capacity: HISTORY_CAPACITY, items: [] },
  });
}

// Build a single-tree BTDocument with `mutate` applied to the (initially empty)
// active tree, and install it on the store. Returns the active tree for
// convenient assertion-side use.
function setupWith(mutate: (tree: BTTreeDef) => BTTreeDef): BTTreeDef {
  const document: BTDocument = createEmptyDocument();
  const treeId = document.mainTreeId;
  const seedTree = document.trees.find((t) => t.id === treeId)!;
  const nextTree = mutate(seedTree);
  const nextDoc: BTDocument = {
    ...document,
    trees: document.trees.map((t) => (t.id === treeId ? nextTree : t)),
  };
  useBTStore.setState({
    document: nextDoc,
    activeTreeId: treeId,
    selection: EMPTY_SELECTION,
    undoStack: { capacity: HISTORY_CAPACITY, items: [] },
    redoStack: { capacity: HISTORY_CAPACITY, items: [] },
  });
  return nextTree;
}

function activeTree() {
  return selectActiveTree(useBTStore.getState());
}

describe('bt-store selection (multi)', () => {
  beforeEach(reset);

  it('selectAll populates nodeIds and edgeIds from the tree', () => {
    const tree = setupWith((t) => {
      let next = addNode(t, 'Sequence', { x: 0, y: 0 });
      next = addNode(next, 'Action', { x: 0, y: 0 });
      const seq = next.nodes.find((n) => n.kind === 'Sequence')!;
      next = connect(next, next.rootId, seq.id);
      return next;
    });

    useBTStore.getState().selectAll();

    const { selection } = useBTStore.getState();
    expect(selection.nodeIds.size).toBe(tree.nodes.length);
    expect(selection.edgeIds.size).toBe(tree.connections.length);
    for (const n of tree.nodes) expect(selection.nodeIds.has(n.id)).toBe(true);
    for (const c of tree.connections) expect(selection.edgeIds.has(c.id)).toBe(true);
  });

  it('deleteSelection removes all selected nodes and edges as one history step', () => {
    const tree = setupWith((t) => {
      let next = addNode(t, 'Sequence', { x: 0, y: 0 });
      next = addNode(next, 'Action', { x: 0, y: 0 });
      const seq = next.nodes.find((n) => n.kind === 'Sequence')!;
      const act = next.nodes.find((n) => n.kind === 'Action')!;
      next = connect(next, seq.id, act.id);
      return next;
    });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    const act = tree.nodes.find((n) => n.kind === 'Action')!;
    const edgeId = tree.connections[0]!.id;

    useBTStore.getState().setSelection({
      nodeIds: new Set([seq.id, act.id]),
      edgeIds: new Set([edgeId]),
    });
    const undoLenBefore = useBTStore.getState().undoStack.items.length;
    useBTStore.getState().deleteSelection();

    const next = activeTree();
    expect(next.nodes.find((n) => n.id === seq.id)).toBeUndefined();
    expect(next.nodes.find((n) => n.id === act.id)).toBeUndefined();
    expect(next.connections).toHaveLength(0);
    expect(useBTStore.getState().selection).toBe(EMPTY_SELECTION);
    expect(useBTStore.getState().undoStack.items.length).toBe(undoLenBefore + 1);
  });

  it('deleteSelection skips Root and still deletes the rest', () => {
    const tree = setupWith((t) => addNode(t, 'Sequence', { x: 0, y: 0 }));
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;

    useBTStore.getState().setSelection({
      nodeIds: new Set([tree.rootId, seq.id]),
      edgeIds: new Set(),
    });
    useBTStore.getState().deleteSelection();

    const next = activeTree();
    expect(next.nodes.find((n) => n.id === tree.rootId)).toBeDefined();
    expect(next.nodes.find((n) => n.id === seq.id)).toBeUndefined();
  });

  it('deleteSelection on empty selection is a no-op (no history push)', () => {
    const undoLenBefore = useBTStore.getState().undoStack.items.length;
    useBTStore.getState().deleteSelection();
    expect(useBTStore.getState().undoStack.items.length).toBe(undoLenBefore);
  });

  it('deleteSelection with only Root selected produces no history push', () => {
    const rootId = activeTree().rootId;
    useBTStore.getState().setSelection({
      nodeIds: new Set([rootId]),
      edgeIds: new Set(),
    });
    const undoLenBefore = useBTStore.getState().undoStack.items.length;
    useBTStore.getState().deleteSelection();
    expect(useBTStore.getState().undoStack.items.length).toBe(undoLenBefore);
    expect(useBTStore.getState().selection).toBe(EMPTY_SELECTION);
  });

  it('removeNode prunes the removed id from selection.nodeIds', () => {
    const tree = setupWith((t) => addNode(t, 'Sequence', { x: 0, y: 0 }));
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;

    useBTStore.getState().setSelection({
      nodeIds: new Set([tree.rootId, seq.id]),
      edgeIds: new Set(),
    });
    useBTStore.getState().removeNode(seq.id);
    const { selection } = useBTStore.getState();
    expect(selection.nodeIds.has(seq.id)).toBe(false);
    expect(selection.nodeIds.has(tree.rootId)).toBe(true);
  });

  it('setActiveTreeId clears the current selection', () => {
    const otherTreeId = crypto.randomUUID();
    const otherRootId = crypto.randomUUID();
    const tree = setupWith((t) => {
      let next = addNode(t, 'Sequence', { x: 0, y: 0 });
      const seq = next.nodes.find((n) => n.kind === 'Sequence')!;
      next = connect(next, next.rootId, seq.id);
      return next;
    });
    // Add a second tree to the document so setActiveTreeId has a target.
    const state = useBTStore.getState();
    useBTStore.setState({
      document: {
        ...state.document,
        trees: [
          ...state.document.trees,
          {
            id: otherTreeId,
            name: 'Other',
            rootId: otherRootId,
            nodes: [
              { id: otherRootId, kind: 'Root' as const, name: '', position: { x: 0, y: 0 }, properties: {} },
            ],
            connections: [],
          },
        ],
      },
    });
    useBTStore.getState().setSelection({
      nodeIds: new Set([tree.rootId]),
      edgeIds: new Set([tree.connections[0]!.id]),
    });

    useBTStore.getState().setActiveTreeId(otherTreeId);

    const { selection, activeTreeId } = useBTStore.getState();
    expect(activeTreeId).toBe(otherTreeId);
    expect(selection.nodeIds.size).toBe(0);
    expect(selection.edgeIds.size).toBe(0);
  });

  it('disconnect prunes the removed edge id from selection.edgeIds', () => {
    const tree = setupWith((t) => {
      let next = addNode(t, 'Sequence', { x: 0, y: 0 });
      const seq = next.nodes.find((n) => n.kind === 'Sequence')!;
      next = connect(next, next.rootId, seq.id);
      return next;
    });
    const edgeId = tree.connections[0]!.id;

    useBTStore.getState().setSelection({
      nodeIds: new Set(),
      edgeIds: new Set([edgeId]),
    });
    useBTStore.getState().disconnect(edgeId);
    expect(useBTStore.getState().selection.edgeIds.has(edgeId)).toBe(false);
  });
});
