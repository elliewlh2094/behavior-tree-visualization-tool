import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../../../src/core/model/tree';
import {
  EMPTY_SELECTION,
  selectActiveTree,
  useBTStore,
} from '../../../src/store/bt-store';
import { GRID_SIZE } from '../../../src/core/config/grid';

function reset(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    selection: EMPTY_SELECTION,
    undoStacks: {},
    redoStacks: {},
    viewportByTreeId: {},
  });
}

function activeTree() {
  return selectActiveTree(useBTStore.getState());
}

function activeUndoItems(): readonly unknown[] {
  const s = useBTStore.getState();
  return s.undoStacks[s.activeTreeId]?.items ?? [];
}

// Build Root → Sequence → [Action 'a', Action 'b'] in the active tree and
// return the four ids for selection assertions.
function buildSmallTree() {
  const store = useBTStore.getState();
  store.addNode('Sequence', { x: 100, y: 100 });
  const seqId = activeTree().nodes.find((n) => n.kind === 'Sequence')!.id;
  store.addNode('Action', { x: 50, y: 200 });
  store.addNode('Action', { x: 150, y: 200 });
  const actions = activeTree().nodes.filter((n) => n.kind === 'Action');
  const aId = actions[0]!.id;
  const bId = actions[1]!.id;
  store.connect(activeTree().rootId, seqId);
  store.connect(seqId, aId);
  store.connect(seqId, bId);
  return { rootId: activeTree().rootId, seqId, aId, bId };
}

describe('bt-store duplicateSelection', () => {
  beforeEach(reset);

  it('happy path: 2 connected nodes duplicate as a connected pair, selection swaps', () => {
    const { seqId, aId } = buildSmallTree();
    useBTStore.setState({
      selection: { nodeIds: new Set([seqId, aId]), edgeIds: new Set() },
    });
    const beforeDup = activeTree();

    useBTStore.getState().duplicateSelection();

    const after = activeTree();
    expect(after.nodes).toHaveLength(beforeDup.nodes.length + 2);
    expect(after.connections).toHaveLength(beforeDup.connections.length + 1);

    const sel = useBTStore.getState().selection;
    expect(sel.nodeIds.size).toBe(2);
    expect(sel.edgeIds.size).toBe(1);
    // None of the duplicates collide with the originals.
    for (const id of sel.nodeIds) expect(id).not.toBe(seqId);
    for (const id of sel.nodeIds) expect(id).not.toBe(aId);

    // One undo restores the pre-duplicate state — single history step.
    useBTStore.getState().undo();
    expect(activeTree()).toBe(beforeDup);
  });

  it('positions duplicates by exactly (GRID_SIZE, GRID_SIZE)', () => {
    const { aId } = buildSmallTree();
    useBTStore.setState({
      selection: { nodeIds: new Set([aId]), edgeIds: new Set() },
    });
    const orig = activeTree().nodes.find((n) => n.id === aId)!;

    useBTStore.getState().duplicateSelection();

    const newId = [...useBTStore.getState().selection.nodeIds][0]!;
    const dup = activeTree().nodes.find((n) => n.id === newId)!;
    expect(dup.position).toEqual({
      x: orig.position.x + GRID_SIZE,
      y: orig.position.y + GRID_SIZE,
    });
  });

  it('empty selection is a no-op (no history push, no state change)', () => {
    buildSmallTree();
    const before = activeTree();
    const undoLenBefore = activeUndoItems().length;
    useBTStore.setState({ selection: EMPTY_SELECTION });

    useBTStore.getState().duplicateSelection();

    expect(activeTree()).toBe(before);
    expect(activeUndoItems().length).toBe(undoLenBefore);
    expect(useBTStore.getState().selection).toBe(EMPTY_SELECTION);
  });

  it('edges-only selection is a no-op (preserves the edge selection)', () => {
    const { rootId, seqId } = buildSmallTree();
    const rootSeqEdge = activeTree().connections.find(
      (c) => c.parentId === rootId && c.childId === seqId,
    )!;
    const before = activeTree();
    const undoLenBefore = activeUndoItems().length;
    const edgeSelection = {
      nodeIds: new Set<string>(),
      edgeIds: new Set([rootSeqEdge.id]),
    };
    useBTStore.setState({ selection: edgeSelection });

    useBTStore.getState().duplicateSelection();

    expect(activeTree()).toBe(before);
    expect(activeUndoItems().length).toBe(undoLenBefore);
    // Edge selection survives the no-op (the user didn't lose what they had).
    expect(useBTStore.getState().selection).toBe(edgeSelection);
  });

  it('Root-only selection is a no-op (Root cannot be duplicated)', () => {
    const { rootId } = buildSmallTree();
    const before = activeTree();
    const undoLenBefore = activeUndoItems().length;
    useBTStore.setState({
      selection: { nodeIds: new Set([rootId]), edgeIds: new Set() },
    });

    useBTStore.getState().duplicateSelection();

    expect(activeTree()).toBe(before);
    expect(activeUndoItems().length).toBe(undoLenBefore);
  });

  it('selection containing Root + others duplicates only the others', () => {
    const { rootId, aId } = buildSmallTree();
    useBTStore.setState({
      selection: { nodeIds: new Set([rootId, aId]), edgeIds: new Set() },
    });
    const beforeCount = activeTree().nodes.length;

    useBTStore.getState().duplicateSelection();

    expect(activeTree().nodes).toHaveLength(beforeCount + 1);
    const sel = useBTStore.getState().selection;
    expect(sel.nodeIds.size).toBe(1);
    expect(sel.nodeIds.has(rootId)).toBe(false);
  });

  it('SubTree.treeRef is preserved on the duplicate', () => {
    useBTStore.getState().addNode('SubTree', { x: 100, y: 100 });
    const subId = activeTree().nodes.find((n) => n.kind === 'SubTree')!.id;
    useBTStore.getState().updateNodeTreeRef(subId, 'Patrol');
    useBTStore.setState({
      selection: { nodeIds: new Set([subId]), edgeIds: new Set() },
    });

    useBTStore.getState().duplicateSelection();

    const newId = [...useBTStore.getState().selection.nodeIds][0]!;
    const dup = activeTree().nodes.find((n) => n.id === newId)!;
    expect(dup.kind).toBe('SubTree');
    expect(dup.treeRef).toBe('Patrol');
  });
});
