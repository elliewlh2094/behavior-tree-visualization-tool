import { describe, expect, it } from 'vitest';
import { createEmptyTree } from '../../../../src/core/model/tree';
import { addNode, moveNode } from '../../../../src/core/model/operations';

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
