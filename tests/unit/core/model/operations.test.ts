import { describe, expect, it } from 'vitest';
import { createEmptyTree } from '../../../../src/core/model/tree';
import {
  addNode,
  connect,
  disconnect,
  moveNode,
  removeNode,
  reorderChildren,
  updateNode,
} from '../../../../src/core/model/operations';

describe('addNode', () => {
  it('adds a non-Root node with the given kind and position', () => {
    const tree = createEmptyTree();
    const next = addNode(tree, 'Sequence', { x: 32, y: 48 });

    expect(next.nodes).toHaveLength(2);
    const added = next.nodes.find((n) => n.kind === 'Sequence');
    expect(added).toBeDefined();
    expect(added!.position).toEqual({ x: 32, y: 48 });
    expect(added!.name).toBe('');
    expect(added!.properties).toEqual({});
    expect(added!.id).not.toBe(tree.rootId);
  });

  it('does not mutate the input tree', () => {
    const tree = createEmptyTree();
    const before = JSON.stringify(tree);
    addNode(tree, 'Action', { x: 0, y: 0 });
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('rejects adding another Root', () => {
    const tree = createEmptyTree();
    expect(() => addNode(tree, 'Root', { x: 0, y: 0 })).toThrow(/root/i);
  });
});

describe('moveNode', () => {
  it('updates the position of the matching node', () => {
    const tree = createEmptyTree();
    const next = moveNode(tree, tree.rootId, { x: 160, y: 80 });
    const moved = next.nodes.find((n) => n.id === tree.rootId);
    expect(moved!.position).toEqual({ x: 160, y: 80 });
  });

  it('preserves other fields on the moved node', () => {
    const tree = createEmptyTree();
    const next = moveNode(tree, tree.rootId, { x: 16, y: 16 });
    const moved = next.nodes.find((n) => n.id === tree.rootId);
    expect(moved!.kind).toBe('Root');
    expect(moved!.name).toBe('Root');
  });

  it('does not mutate the input tree', () => {
    const tree = createEmptyTree();
    const before = JSON.stringify(tree);
    moveNode(tree, tree.rootId, { x: 200, y: 200 });
    expect(JSON.stringify(tree)).toBe(before);
  });

  it('throws when the node id does not exist', () => {
    const tree = createEmptyTree();
    expect(() => moveNode(tree, 'no-such-id', { x: 0, y: 0 })).toThrow(/not found/i);
  });
});

describe('connect', () => {
  it('adds a parent→child connection with order = 0 for the first child', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const child = tree.nodes.find((n) => n.kind === 'Sequence')!;

    const next = connect(tree, tree.rootId, child.id);

    expect(next.connections).toHaveLength(1);
    const c = next.connections[0]!;
    expect(c.parentId).toBe(tree.rootId);
    expect(c.childId).toBe(child.id);
    expect(c.order).toBe(0);
    expect(c.id).toBeTruthy();
  });

  it('assigns order = max-sibling + 1 under the same parent', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    tree = addNode(tree, 'Action', { x: 0, y: 0 });
    tree = addNode(tree, 'Condition', { x: 0, y: 0 });
    const [seq, a1, a2] = [
      tree.nodes.find((n) => n.kind === 'Sequence')!,
      tree.nodes.find((n) => n.kind === 'Action')!,
      tree.nodes.find((n) => n.kind === 'Condition')!,
    ];

    let t = connect(tree, seq.id, a1.id);
    t = connect(t, seq.id, a2.id);

    const orders = t.connections
      .filter((c) => c.parentId === seq.id)
      .map((c) => c.order)
      .sort((x, y) => x - y);
    expect(orders).toEqual([0, 1]);
  });

  it('rejects an exact-duplicate edge (same parent + child)', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const child = tree.nodes.find((n) => n.kind === 'Sequence')!;
    tree = connect(tree, tree.rootId, child.id);

    expect(() => connect(tree, tree.rootId, child.id)).toThrow(/duplicate/i);
  });

  it('rejects a self-loop', () => {
    const tree = createEmptyTree();
    expect(() => connect(tree, tree.rootId, tree.rootId)).toThrow(/self/i);
  });

  it('throws when parent or child id does not exist', () => {
    const tree = createEmptyTree();
    expect(() => connect(tree, 'no-such', tree.rootId)).toThrow(/not found/i);
    expect(() => connect(tree, tree.rootId, 'no-such')).toThrow(/not found/i);
  });

  it('does not mutate the input tree', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const child = tree.nodes.find((n) => n.kind === 'Sequence')!;
    const before = JSON.stringify(tree);
    connect(tree, tree.rootId, child.id);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('disconnect', () => {
  it('removes the matching connection and leaves nodes intact', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const child = tree.nodes.find((n) => n.kind === 'Sequence')!;
    tree = connect(tree, tree.rootId, child.id);
    const connId = tree.connections[0]!.id;

    const next = disconnect(tree, connId);

    expect(next.connections).toHaveLength(0);
    expect(next.nodes).toHaveLength(2);
  });

  it('throws when the connection id does not exist', () => {
    const tree = createEmptyTree();
    expect(() => disconnect(tree, 'no-such')).toThrow(/not found/i);
  });

  it('does not mutate the input tree', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const child = tree.nodes.find((n) => n.kind === 'Sequence')!;
    tree = connect(tree, tree.rootId, child.id);
    const connId = tree.connections[0]!.id;
    const before = JSON.stringify(tree);
    disconnect(tree, connId);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('removeNode', () => {
  it('removes a non-Root node and all incident connections, leaving children as orphans', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    tree = addNode(tree, 'Action', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    const act = tree.nodes.find((n) => n.kind === 'Action')!;
    tree = connect(tree, tree.rootId, seq.id);
    tree = connect(tree, seq.id, act.id);

    const next = removeNode(tree, seq.id);

    expect(next.nodes.find((n) => n.id === seq.id)).toBeUndefined();
    expect(next.nodes.find((n) => n.id === act.id)).toBeDefined(); // orphan preserved
    expect(next.connections).toHaveLength(0); // both incident edges gone
  });

  it('is a no-op when called with the Root id', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const before = JSON.stringify(tree);

    const next = removeNode(tree, tree.rootId);

    expect(JSON.stringify(next)).toBe(before);
    expect(next.nodes.find((n) => n.id === tree.rootId)).toBeDefined();
  });

  it('throws when the node id does not exist', () => {
    const tree = createEmptyTree();
    expect(() => removeNode(tree, 'no-such')).toThrow(/not found/i);
  });

  it('does not mutate the input tree', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;
    tree = connect(tree, tree.rootId, seq.id);
    const before = JSON.stringify(tree);
    removeNode(tree, seq.id);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('updateNode', () => {
  it('updates the name of a node', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 16, y: 16 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;

    const next = updateNode(tree, seq.id, { name: 'Patrol' });

    const updated = next.nodes.find((n) => n.id === seq.id)!;
    expect(updated.name).toBe('Patrol');
    expect(updated.kind).toBe('Sequence');
    expect(updated.position).toEqual({ x: 16, y: 16 });
  });

  it('updates the kind of a non-Root node', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Sequence', { x: 0, y: 0 });
    const seq = tree.nodes.find((n) => n.kind === 'Sequence')!;

    const next = updateNode(tree, seq.id, { kind: 'Fallback' });

    const updated = next.nodes.find((n) => n.id === seq.id)!;
    expect(updated.kind).toBe('Fallback');
    expect(updated.id).toBe(seq.id);
  });

  it('allows renaming the Root', () => {
    const tree = createEmptyTree();
    const next = updateNode(tree, tree.rootId, { name: 'Start' });
    const updated = next.nodes.find((n) => n.id === tree.rootId)!;
    expect(updated.name).toBe('Start');
    expect(updated.kind).toBe('Root');
  });

  it('rejects a kind change on the Root', () => {
    const tree = createEmptyTree();
    expect(() => updateNode(tree, tree.rootId, { kind: 'Sequence' })).toThrow(
      /root/i,
    );
  });

  it('throws when the node id does not exist', () => {
    const tree = createEmptyTree();
    expect(() => updateNode(tree, 'no-such', { name: 'x' })).toThrow(/not found/i);
  });

  it('is a no-op when the patch is empty (returns equal content)', () => {
    const tree = createEmptyTree();
    const next = updateNode(tree, tree.rootId, {});
    expect(next.nodes.find((n) => n.id === tree.rootId)).toEqual(
      tree.nodes.find((n) => n.id === tree.rootId),
    );
  });

  it('does not mutate the input tree', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, 'Action', { x: 0, y: 0 });
    const act = tree.nodes.find((n) => n.kind === 'Action')!;
    const before = JSON.stringify(tree);
    updateNode(tree, act.id, { name: 'Attack', kind: 'Condition' });
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('reorderChildren', () => {
  function treeWithSiblings(count: number) {
    let t = createEmptyTree();
    const parentId = t.rootId;
    const childIds: string[] = [];
    for (let i = 0; i < count; i++) {
      t = addNode(t, 'Action', { x: i * 100, y: 100 });
      const added = t.nodes[t.nodes.length - 1]!;
      childIds.push(added.id);
      t = connect(t, parentId, added.id);
    }
    return { tree: t, parentId, childIds };
  }

  it('renumbers siblings to contiguous 0..n-1 in the given order', () => {
    const { tree, parentId, childIds } = treeWithSiblings(3);
    const reversed = [...childIds].reverse();
    const next = reorderChildren(tree, parentId, reversed);

    const ordersByChild = new Map(
      next.connections
        .filter((c) => c.parentId === parentId)
        .map((c) => [c.childId, c.order]),
    );
    expect(ordersByChild.get(reversed[0]!)).toBe(0);
    expect(ordersByChild.get(reversed[1]!)).toBe(1);
    expect(ordersByChild.get(reversed[2]!)).toBe(2);
  });

  it('returns the same tree reference when order is unchanged', () => {
    const { tree, parentId, childIds } = treeWithSiblings(3);
    const next = reorderChildren(tree, parentId, childIds);
    expect(next).toBe(tree);
  });

  it('rewrites non-contiguous orders (post-disconnect) into 0..n-1', () => {
    // Build [0, 1, 2], disconnect middle → leaves [0, 2].
    const { tree: built, parentId, childIds } = treeWithSiblings(3);
    let tree = built;
    const middle = tree.connections.find(
      (c) => c.parentId === parentId && c.childId === childIds[1],
    )!;
    tree = disconnect(tree, middle.id);
    const remaining = [childIds[0]!, childIds[2]!];
    const next = reorderChildren(tree, parentId, remaining);

    const orders = next.connections
      .filter((c) => c.parentId === parentId)
      .map((c) => c.order)
      .sort();
    expect(orders).toEqual([0, 1]);
  });

  it('does not touch connections under other parents', () => {
    let t = createEmptyTree();
    const root = t.rootId;
    t = addNode(t, 'Sequence', { x: 0, y: 0 });
    const seq = t.nodes[t.nodes.length - 1]!;
    t = connect(t, root, seq.id);
    t = addNode(t, 'Action', { x: 0, y: 0 });
    const a = t.nodes[t.nodes.length - 1]!;
    t = addNode(t, 'Action', { x: 0, y: 0 });
    const b = t.nodes[t.nodes.length - 1]!;
    t = connect(t, seq.id, a.id);
    t = connect(t, seq.id, b.id);
    const rootSeqConn = t.connections.find(
      (c) => c.parentId === root && c.childId === seq.id,
    )!;
    const rootSeqOrder = rootSeqConn.order;

    const reordered = reorderChildren(t, seq.id, [b.id, a.id]);
    const rootSeqAfter = reordered.connections.find(
      (c) => c.parentId === root && c.childId === seq.id,
    )!;
    expect(rootSeqAfter.order).toBe(rootSeqOrder);
  });

  it('rejects a list with the wrong length', () => {
    const { tree, parentId, childIds } = treeWithSiblings(3);
    expect(() =>
      reorderChildren(tree, parentId, [childIds[0]!, childIds[1]!]),
    ).toThrow(/expected 3 child/);
  });

  it('rejects a child id that is not under the given parent', () => {
    const { tree, parentId, childIds } = treeWithSiblings(2);
    expect(() =>
      reorderChildren(tree, parentId, [childIds[0]!, 'bogus']),
    ).toThrow(/is not under parent/);
  });

  it('rejects duplicate child ids in the list', () => {
    const { tree, parentId, childIds } = treeWithSiblings(2);
    expect(() =>
      reorderChildren(tree, parentId, [childIds[0]!, childIds[0]!]),
    ).toThrow(/duplicate/);
  });

  it('does not mutate the input tree', () => {
    const { tree, parentId, childIds } = treeWithSiblings(3);
    const snapshot = JSON.stringify(tree);
    reorderChildren(tree, parentId, [...childIds].reverse());
    expect(JSON.stringify(tree)).toBe(snapshot);
  });
});
