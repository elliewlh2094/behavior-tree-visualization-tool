import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyTree } from '../../../src/core/model/tree';
import { addNode, connect } from '../../../src/core/model/operations';
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
  });
}

describe('bt-store selection (multi)', () => {
  beforeEach(reset);

  it('selectAll populates nodeIds and edgeIds from the tree', () => {
    let tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    tree = addNode(tree, 'Action', { x: 0, y: 0 });
    const parentId = tree.rootId;
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    tree = connect(tree, parentId, seq.id);
    useBTStore.setState({ tree });

    useBTStore.getState().selectAll();

    const { selection } = useBTStore.getState();
    expect(selection.nodeIds.size).toBe(tree.nodes.length);
    expect(selection.edgeIds.size).toBe(tree.connections.length);
    for (const n of tree.nodes) expect(selection.nodeIds.has(n.id)).toBe(true);
    for (const c of tree.connections) expect(selection.edgeIds.has(c.id)).toBe(true);
  });

  it('deleteSelection removes all selected nodes and edges as one history step', () => {
    let tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    tree = addNode(tree, 'Action', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    const act = tree.nodes.find((n) => n.kind === 'Action')!;
    tree = connect(tree, seq.id, act.id);
    const edgeId = tree.connections[0]!.id;
    useBTStore.setState({ tree });

    useBTStore.getState().setSelection({
      nodeIds: new Set([seq.id, act.id]),
      edgeIds: new Set([edgeId]),
    });
    const undoLenBefore = useBTStore.getState().undoStack.items.length;
    useBTStore.getState().deleteSelection();

    const next = useBTStore.getState();
    expect(next.tree.nodes.find((n) => n.id === seq.id)).toBeUndefined();
    expect(next.tree.nodes.find((n) => n.id === act.id)).toBeUndefined();
    expect(next.tree.connections).toHaveLength(0);
    expect(next.selection).toBe(EMPTY_SELECTION);
    expect(next.undoStack.items.length).toBe(undoLenBefore + 1);
  });

  it('deleteSelection skips Root and still deletes the rest', () => {
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    useBTStore.setState({ tree });

    useBTStore.getState().setSelection({
      nodeIds: new Set([tree.rootId, seq.id]),
      edgeIds: new Set(),
    });
    useBTStore.getState().deleteSelection();

    const { tree: next } = useBTStore.getState();
    expect(next.nodes.find((n) => n.id === tree.rootId)).toBeDefined();
    expect(next.nodes.find((n) => n.id === seq.id)).toBeUndefined();
  });

  it('deleteSelection on empty selection is a no-op (no history push)', () => {
    const undoLenBefore = useBTStore.getState().undoStack.items.length;
    useBTStore.getState().deleteSelection();
    expect(useBTStore.getState().undoStack.items.length).toBe(undoLenBefore);
  });

  it('deleteSelection with only Root selected produces no history push', () => {
    const rootId = useBTStore.getState().tree.rootId;
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
    const tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    useBTStore.setState({ tree });
    useBTStore.getState().setSelection({
      nodeIds: new Set([tree.rootId, seq.id]),
      edgeIds: new Set(),
    });
    useBTStore.getState().removeNode(seq.id);
    const { selection } = useBTStore.getState();
    expect(selection.nodeIds.has(seq.id)).toBe(false);
    expect(selection.nodeIds.has(tree.rootId)).toBe(true);
  });

  it('disconnect prunes the removed edge id from selection.edgeIds', () => {
    let tree = addNode(createEmptyTree(), 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    tree = connect(tree, tree.rootId, seq.id);
    const edgeId = tree.connections[0]!.id;
    useBTStore.setState({ tree });
    useBTStore.getState().setSelection({
      nodeIds: new Set(),
      edgeIds: new Set([edgeId]),
    });
    useBTStore.getState().disconnect(edgeId);
    expect(useBTStore.getState().selection.edgeIds.has(edgeId)).toBe(false);
  });
});
