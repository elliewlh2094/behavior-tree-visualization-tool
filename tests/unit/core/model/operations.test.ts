import { describe, expect, it } from 'vitest';
import { createEmptyTree } from '../../../../src/core/model/tree';
import {
  addNode,
  connect,
  disconnect,
  moveNode,
  removeNode,
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
