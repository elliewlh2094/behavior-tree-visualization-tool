import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../../../src/core/model/tree';
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

function activeTree() {
  return selectActiveTree(useBTStore.getState());
}

describe('bt-store history', () => {
  beforeEach(reset);

  it('addNode is undoable and redoable', () => {
    const beforeAdd = activeTree();
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    expect(activeTree().nodes).toHaveLength(2);

    useBTStore.getState().undo();
    expect(activeTree()).toBe(beforeAdd);

    useBTStore.getState().redo();
    expect(activeTree().nodes).toHaveLength(2);
  });

  it('connect is undoable', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    const beforeConnect = activeTree();
    const parentId = beforeConnect.rootId;
    const childId = beforeConnect.nodes.find((n) => n.kind === 'Sequence')!.id;
    useBTStore.getState().connect(parentId, childId);
    expect(activeTree().connections).toHaveLength(1);

    useBTStore.getState().undo();
    expect(activeTree()).toBe(beforeConnect);
  });

  it('updateNodeKind is undoable', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    const seqId = activeTree().nodes.find((n) => n.kind === 'Sequence')!.id;
    const before = activeTree();
    useBTStore.getState().updateNodeKind(seqId, 'Fallback');
    expect(activeTree().nodes.find((n) => n.id === seqId)!.kind).toBe('Fallback');

    useBTStore.getState().undo();
    expect(activeTree()).toBe(before);
  });

  it('updateNodeName does NOT snapshot on its own (gesture-scoped)', () => {
    const root = activeTree().rootId;
    useBTStore.getState().updateNodeName(root, 'r');
    useBTStore.getState().updateNodeName(root, 're');
    useBTStore.getState().updateNodeName(root, 'ren');
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
  });

  it('beginGesture + updateNodeName is a single undoable step', () => {
    const root = activeTree().rootId;
    const before = activeTree();
    useBTStore.getState().beginGesture();
    useBTStore.getState().updateNodeName(root, 'r');
    useBTStore.getState().updateNodeName(root, 're');
    useBTStore.getState().updateNodeName(root, 'ren');
    useBTStore.getState().updateNodeName(root, 'renamed');

    expect(useBTStore.getState().undoStack.items).toHaveLength(1);
    useBTStore.getState().undo();
    expect(activeTree()).toBe(before);
  });

  it('moveNode does NOT snapshot on its own (gesture-scoped)', () => {
    const root = activeTree().rootId;
    useBTStore.getState().moveNode(root, { x: 100, y: 100 });
    useBTStore.getState().moveNode(root, { x: 200, y: 200 });
    useBTStore.getState().moveNode(root, { x: 300, y: 300 });
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
  });

  it('beginGesture + moveNode is a single undoable step', () => {
    const root = activeTree().rootId;
    const before = activeTree();
    useBTStore.getState().beginGesture();
    useBTStore.getState().moveNode(root, { x: 100, y: 100 });
    useBTStore.getState().moveNode(root, { x: 200, y: 200 });

    expect(useBTStore.getState().undoStack.items).toHaveLength(1);
    useBTStore.getState().undo();
    expect(activeTree()).toBe(before);
  });

  it('ring buffer caps history at HISTORY_CAPACITY; oldest is evicted', () => {
    const snapshots: unknown[] = [];
    // HISTORY_CAPACITY + 1 actions; the first snapshot (empty tree) should be evicted.
    for (let i = 0; i < HISTORY_CAPACITY + 1; i++) {
      snapshots.push(activeTree());
      useBTStore.getState().addNode('Sequence', { x: i, y: i });
    }
    expect(useBTStore.getState().undoStack.items).toHaveLength(HISTORY_CAPACITY);
    expect(useBTStore.getState().undoStack.items[0]).toBe(snapshots[1]);
  });

  it('after HISTORY_CAPACITY undos, the next undo is a no-op', () => {
    for (let i = 0; i < HISTORY_CAPACITY + 1; i++) {
      useBTStore.getState().addNode('Sequence', { x: i, y: i });
    }
    for (let i = 0; i < HISTORY_CAPACITY; i++) {
      useBTStore.getState().undo();
    }
    const afterAllUndos = activeTree();
    useBTStore.getState().undo();
    expect(activeTree()).toBe(afterAllUndos);
  });

  it('a new action after undo clears the redo stack', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    useBTStore.getState().addNode('Fallback', { x: 0, y: 0 });
    useBTStore.getState().undo();
    expect(useBTStore.getState().redoStack.items).toHaveLength(1);

    useBTStore.getState().addNode('Action', { x: 0, y: 0 });
    expect(useBTStore.getState().redoStack.items).toHaveLength(0);
  });

  it('setDocument (Open) clears both history stacks', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    useBTStore.getState().addNode('Fallback', { x: 0, y: 0 });
    useBTStore.getState().undo();
    expect(useBTStore.getState().undoStack.items.length).toBeGreaterThan(0);
    expect(useBTStore.getState().redoStack.items.length).toBeGreaterThan(0);

    useBTStore.getState().setDocument(createEmptyDocument());
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
    expect(useBTStore.getState().redoStack.items).toHaveLength(0);
  });

  it('undo clears selection', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    const addedId = activeTree().nodes.find((n) => n.kind === 'Sequence')!.id;
    useBTStore.getState().setSelection({
      nodeIds: new Set([addedId]),
      edgeIds: new Set(),
    });
    useBTStore.getState().undo();
    const { selection } = useBTStore.getState();
    expect(selection.nodeIds.size).toBe(0);
    expect(selection.edgeIds.size).toBe(0);
  });

  it('no-op ops do not snapshot (removeNode on Root)', () => {
    const root = activeTree().rootId;
    useBTStore.getState().removeNode(root);
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
  });
});
