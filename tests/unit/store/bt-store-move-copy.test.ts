import { beforeEach, describe, expect, it } from 'vitest';
import type { BTConnection, BTDocument, BTNode, BTTreeDef } from '../../../src/core/model/node';
import {
  type DocSnapshot,
  type Selection,
  EMPTY_SELECTION,
  HISTORY_CAPACITY,
  useBTStore,
} from '../../../src/store/bt-store';
import { createRingBuffer } from '../../../src/core/history/ring-buffer';

function node(id: string, kind: BTNode['kind'] = 'Action', x = 0, y = 0): BTNode {
  return { id, kind, name: id, position: { x, y }, properties: {} };
}
function conn(id: string, parentId: string, childId: string, order = 0): BTConnection {
  return { id, parentId, childId, order };
}

// Tree A: R → S, S → A (0), S → B (1). Tree B: just its own root.
function treeA(): BTTreeDef {
  return {
    id: 'A',
    name: 'A',
    rootId: 'AR',
    nodes: [node('AR', 'Root'), node('S', 'Sequence', 10, 20), node('a', 'Action', 30, 40), node('b', 'Action', 50, 60)],
    connections: [conn('e_RS', 'AR', 'S'), conn('e_SA', 'S', 'a', 0), conn('e_SB', 'S', 'b', 1)],
  };
}
function treeB(): BTTreeDef {
  return { id: 'B', name: 'B', rootId: 'BR', nodes: [node('BR', 'Root')], connections: [] };
}

function install(activeTreeId: string, selection: Selection): BTDocument {
  const document: BTDocument = { version: 2, mainTreeId: 'A', trees: [treeA(), treeB()] };
  useBTStore.setState({
    document,
    activeTreeId,
    selection,
    undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
    viewportByTreeId: {},
  });
  return document;
}

const sel = (...ids: string[]): Selection => ({ nodeIds: new Set(ids), edgeIds: new Set() });
const treeById = (id: string): BTTreeDef =>
  useBTStore.getState().document.trees.find((t) => t.id === id)!;

describe('bt-store moveCopyToTree — Move', () => {
  beforeEach(() => install('A', sel('S', 'a', 'b')));

  it('moves nodes from active tree to destination, switches tab, selects transferred', () => {
    useBTStore.getState().moveCopyToTree('B', 'move');

    const state = useBTStore.getState();
    expect(treeById('A').nodes.map((n) => n.id)).toEqual(['AR']);
    expect(treeById('B').nodes.map((n) => n.id)).toEqual(['BR', 'S', 'a', 'b']);
    expect(treeById('B').connections.map((c) => c.id)).toEqual(['e_SA', 'e_SB']);
    expect(state.activeTreeId).toBe('B');
    expect([...state.selection.nodeIds].sort()).toEqual(['S', 'a', 'b']);
  });

  it('single Ctrl+Z reverts both trees + active tab in one step (byte-identical)', () => {
    const before = JSON.stringify(useBTStore.getState().document);

    useBTStore.getState().moveCopyToTree('B', 'move');
    useBTStore.getState().undo();

    expect(JSON.stringify(useBTStore.getState().document)).toBe(before);
    // stillExists rule: active stays B (B still exists in the restored doc).
    expect(useBTStore.getState().activeTreeId).toBe('B');
  });

  it('single redo replays the move in one step', () => {
    useBTStore.getState().moveCopyToTree('B', 'move');
    const afterMove = JSON.stringify(useBTStore.getState().document);

    useBTStore.getState().undo();
    useBTStore.getState().redo();

    expect(JSON.stringify(useBTStore.getState().document)).toBe(afterMove);
    expect(treeById('A').nodes.map((n) => n.id)).toEqual(['AR']);
  });
});

describe('bt-store moveCopyToTree — Copy', () => {
  beforeEach(() => install('A', sel('S', 'a', 'b')));

  it('copies nodes to destination with new ids; source unchanged', () => {
    useBTStore.getState().moveCopyToTree('B', 'copy');

    const state = useBTStore.getState();
    // Source intact.
    expect(treeById('A').nodes.map((n) => n.id)).toEqual(['AR', 'S', 'a', 'b']);
    // Dest gained 3 fresh-id nodes.
    const appended = treeById('B').nodes.filter((n) => n.id !== 'BR');
    expect(appended).toHaveLength(3);
    for (const n of appended) expect(['S', 'a', 'b']).not.toContain(n.id);
    expect(state.activeTreeId).toBe('B');
    expect(state.selection.nodeIds.size).toBe(3);
  });

  it('single Ctrl+Z reverts the copy in one step', () => {
    const before = JSON.stringify(useBTStore.getState().document);
    useBTStore.getState().moveCopyToTree('B', 'copy');
    useBTStore.getState().undo();
    expect(JSON.stringify(useBTStore.getState().document)).toBe(before);
  });
});

describe('bt-store moveCopyToTree — no-op', () => {
  it('does nothing (no snapshot) on empty selection', () => {
    install('A', EMPTY_SELECTION);
    const before = useBTStore.getState().document;

    useBTStore.getState().moveCopyToTree('B', 'move');

    expect(useBTStore.getState().document).toBe(before);
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
    expect(useBTStore.getState().activeTreeId).toBe('A');
  });

  it('does nothing when destination is the active tree', () => {
    install('A', sel('S', 'a', 'b'));
    const before = useBTStore.getState().document;

    useBTStore.getState().moveCopyToTree('A', 'move');

    expect(useBTStore.getState().document).toBe(before);
    expect(useBTStore.getState().undoStack.items).toHaveLength(0);
  });
});
