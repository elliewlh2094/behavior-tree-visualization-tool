import { describe, expect, it } from 'vitest';
import { createEmptyDocument, createEmptyTree } from '../../../../src/core/model/tree';

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

describe('createEmptyDocument', () => {
  it('returns a v2 document with one tree named "Main" containing a Root', () => {
    const doc = createEmptyDocument();

    expect(doc.version).toBe(2);
    expect(doc.trees).toHaveLength(1);

    const tree = doc.trees[0]!;
    expect(tree.name).toBe('Main');
    expect(doc.mainTreeId).toBe(tree.id);
    expect(tree.connections).toEqual([]);
    expect(tree.nodes).toHaveLength(1);

    const root = tree.nodes[0]!;
    expect(root.kind).toBe('Root');
    expect(root.id).toBe(tree.rootId);
  });

  it('uses distinct ids for tree and root', () => {
    const doc = createEmptyDocument();
    expect(doc.mainTreeId).not.toBe(doc.trees[0]!.rootId);
  });
});
