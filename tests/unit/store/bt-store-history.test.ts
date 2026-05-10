import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDocument } from '../../../src/core/model/tree';
import {
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  selectActiveTree,
  useBTStore,
  type DocSnapshot,
} from '../../../src/store/bt-store';
import { createRingBuffer } from '../../../src/core/history/ring-buffer';

function reset(): void {
  const document = createEmptyDocument();
  useBTStore.setState({
    document,
    activeTreeId: document.mainTreeId,
    selection: EMPTY_SELECTION,
    undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    viewportByTreeId: {},
  });
}

function activeTree() {
  return selectActiveTree(useBTStore.getState());
}

// v1.7.1: history is a single timeline of full-document snapshots.
function undoItems(): readonly DocSnapshot[] {
  return useBTStore.getState().undoStack.items;
}
function redoItems(): readonly DocSnapshot[] {
  return useBTStore.getState().redoStack.items;
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
    expect(undoItems()).toHaveLength(0);
  });

  it('beginGesture + updateNodeName is a single undoable step', () => {
    const root = activeTree().rootId;
    const before = activeTree();
    useBTStore.getState().beginGesture();
    useBTStore.getState().updateNodeName(root, 'r');
    useBTStore.getState().updateNodeName(root, 're');
    useBTStore.getState().updateNodeName(root, 'ren');
    useBTStore.getState().updateNodeName(root, 'renamed');

    expect(undoItems()).toHaveLength(1);
    useBTStore.getState().undo();
    expect(activeTree()).toBe(before);
  });

  it('moveNode does NOT snapshot on its own (gesture-scoped)', () => {
    const root = activeTree().rootId;
    useBTStore.getState().moveNode(root, { x: 100, y: 100 });
    useBTStore.getState().moveNode(root, { x: 200, y: 200 });
    useBTStore.getState().moveNode(root, { x: 300, y: 300 });
    expect(undoItems()).toHaveLength(0);
  });

  it('beginGesture + moveNode is a single undoable step', () => {
    const root = activeTree().rootId;
    const before = activeTree();
    useBTStore.getState().beginGesture();
    useBTStore.getState().moveNode(root, { x: 100, y: 100 });
    useBTStore.getState().moveNode(root, { x: 200, y: 200 });

    expect(undoItems()).toHaveLength(1);
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
    expect(undoItems()).toHaveLength(HISTORY_CAPACITY);
    const mainId = useBTStore.getState().activeTreeId;
    expect(
      undoItems()[0]!.document.trees.find((t) => t.id === mainId),
    ).toBe(snapshots[1]);
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
    expect(redoItems()).toHaveLength(1);

    useBTStore.getState().addNode('Action', { x: 0, y: 0 });
    expect(redoItems()).toHaveLength(0);
  });

  it('setDocument (Open) clears both history stacks', () => {
    useBTStore.getState().addNode('Sequence', { x: 0, y: 0 });
    useBTStore.getState().addNode('Fallback', { x: 0, y: 0 });
    useBTStore.getState().undo();
    expect(undoItems().length).toBeGreaterThan(0);
    expect(redoItems().length).toBeGreaterThan(0);

    useBTStore.getState().setDocument(createEmptyDocument());
    expect(undoItems()).toHaveLength(0);
    expect(redoItems()).toHaveLength(0);
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
    expect(undoItems()).toHaveLength(0);
  });
});
