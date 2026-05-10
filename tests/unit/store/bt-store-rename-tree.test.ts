import { beforeEach, describe, expect, it } from 'vitest';
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

describe('bt-store renameTree', () => {
  beforeEach(() => {
    useBTStore.setState({
      undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
      redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
      viewportByTreeId: {},
    });
  });

  it('renames the target tree', () => {
    const main = makeTree({ id: 'main', name: 'Main' });
    const patrol = makeTree({ id: 'patrol', name: 'Patrol' });
    install({ version: 2, mainTreeId: 'main', trees: [main, patrol] }, 'main');

    useBTStore.getState().renameTree('patrol', 'Combat');

    const trees = useBTStore.getState().document.trees;
    expect(trees.find((t) => t.id === 'patrol')!.name).toBe('Combat');
    expect(trees.some((t) => t.name === 'Patrol')).toBe(false);
  });

  it('propagates the new name to every SubTree node referencing the old name', () => {
    const main = makeTree({
      id: 'main',
      name: 'Main',
      extraNodes: [subtreeNode('s1', 'Patrol'), subtreeNode('s2', 'Patrol', 'custom-label')],
    });
    const other = makeTree({
      id: 'other',
      name: 'Other',
      extraNodes: [subtreeNode('s3', 'Patrol')],
    });
    const patrol = makeTree({ id: 'patrol', name: 'Patrol' });
    install(
      { version: 2, mainTreeId: 'main', trees: [main, other, patrol] },
      'main',
    );

    useBTStore.getState().renameTree('patrol', 'Combat');

    const doc = useBTStore.getState().document;
    const allSubtrees = doc.trees.flatMap((t) => t.nodes.filter((n) => n.kind === 'SubTree'));
    expect(allSubtrees).toHaveLength(3);
    for (const n of allSubtrees) {
      expect(n.treeRef).toBe('Combat');
      expect(n.name).toBe('Combat');
    }
  });

  it('does not touch SubTree nodes whose treeRef does not match the renamed tree', () => {
    const main = makeTree({
      id: 'main',
      name: 'Main',
      extraNodes: [subtreeNode('s1', 'Patrol'), subtreeNode('s2', 'Combat')],
    });
    const patrol = makeTree({ id: 'patrol', name: 'Patrol' });
    const combat = makeTree({ id: 'combat', name: 'Combat' });
    install(
      { version: 2, mainTreeId: 'main', trees: [main, patrol, combat] },
      'main',
    );

    useBTStore.getState().renameTree('patrol', 'Recon');

    const subtrees = useBTStore
      .getState()
      .document.trees.find((t) => t.id === 'main')!
      .nodes.filter((n) => n.kind === 'SubTree');
    const s1 = subtrees.find((n) => n.id === 's1')!;
    const s2 = subtrees.find((n) => n.id === 's2')!;
    expect(s1.treeRef).toBe('Recon');
    expect(s1.name).toBe('Recon');
    expect(s2.treeRef).toBe('Combat');
    expect(s2.name).toBe('Combat');
  });

  it('is a no-op when the new name equals the current name', () => {
    const main = makeTree({ id: 'main', name: 'Main' });
    install({ version: 2, mainTreeId: 'main', trees: [main] }, 'main');
    const before = useBTStore.getState().document;

    useBTStore.getState().renameTree('main', 'Main');

    expect(useBTStore.getState().document).toBe(before);
  });

  it('is a no-op when the treeId does not exist', () => {
    const main = makeTree({ id: 'main', name: 'Main' });
    install({ version: 2, mainTreeId: 'main', trees: [main] }, 'main');
    const before = useBTStore.getState().document;

    useBTStore.getState().renameTree('nonexistent', 'Whatever');

    expect(useBTStore.getState().document).toBe(before);
  });

  it('pushes a snapshot of the pre-action document and activeTreeId (v1.7.1)', () => {
    const main = makeTree({ id: 'main', name: 'Main' });
    const patrol = makeTree({ id: 'patrol', name: 'Patrol' });
    install({ version: 2, mainTreeId: 'main', trees: [main, patrol] }, 'main');
    const prevDocument = useBTStore.getState().document;

    useBTStore.getState().renameTree('patrol', 'Combat');

    const { undoStack } = useBTStore.getState();
    expect(undoStack.items).toHaveLength(1);
    expect(undoStack.items[0]!.document).toBe(prevDocument);
    expect(undoStack.items[0]!.activeTreeId).toBe('main');
  });
});
