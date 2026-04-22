import { describe, expect, it } from 'vitest';
import { createEmptyTree } from '../../../../src/core/model/tree';

describe('createEmptyTree', () => {
  it('returns a tree with one Root node whose id equals rootId', () => {
    const tree = createEmptyTree();

    expect(tree.version).toBe(1);
    expect(tree.connections).toEqual([]);
    expect(tree.nodes).toHaveLength(1);

    const root = tree.nodes[0];
    expect(root).toBeDefined();
    expect(root!.kind).toBe('Root');
    expect(root!.id).toBe(tree.rootId);
  });

  it('produces independent trees on each call', () => {
    const a = createEmptyTree();
    const b = createEmptyTree();

    expect(a.rootId).not.toBe(b.rootId);
    a.nodes[0]!.name = 'mutated';
    expect(b.nodes[0]!.name).not.toBe('mutated');
  });
});
