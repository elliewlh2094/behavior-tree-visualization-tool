import { describe, expect, it } from 'vitest';
import { btTreeSchema } from '../../../../src/core/schema/bt-schema';
import type { BehaviorTree } from '../../../../src/core/model/node';

const validMinimal: BehaviorTree = {
  version: 1,
  rootId: 'root-1',
  nodes: [
    {
      id: 'root-1',
      kind: 'Root',
      name: 'Root',
      position: { x: 0, y: 0 },
      properties: {},
    },
  ],
  connections: [],
};

const validFiveNode: BehaviorTree = {
  version: 1,
  rootId: 'root-1',
  nodes: [
    { id: 'root-1', kind: 'Root', name: 'Root', position: { x: 400, y: 80 }, properties: {} },
    { id: 'seq-1', kind: 'Sequence', name: 'seq', position: { x: 400, y: 200 }, properties: {} },
    { id: 'a1', kind: 'Action', name: 'a1', position: { x: 240, y: 320 }, properties: {} },
  ],
  connections: [
    { id: 'c1', parentId: 'root-1', childId: 'seq-1', order: 0 },
    { id: 'c2', parentId: 'seq-1', childId: 'a1', order: 0 },
  ],
};

describe('btTreeSchema — happy path', () => {
  it('accepts a minimal Root-only tree', () => {
    const result = btTreeSchema.safeParse(validMinimal);
    expect(result.success).toBe(true);
  });

  it('accepts the worked five-node example shape', () => {
    const result = btTreeSchema.safeParse(validFiveNode);
    expect(result.success).toBe(true);
  });

  it('preserves non-empty properties (forward-compat per format §3)', () => {
    const tree = structuredClone(validMinimal);
    tree.nodes[0]!.properties = { customKey: 'value', nested: { n: 1 } };
    const result = btTreeSchema.safeParse(tree);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0]!.properties).toEqual({ customKey: 'value', nested: { n: 1 } });
    }
  });
});

describe('btTreeSchema — top-level shape', () => {
  it('rejects version other than 1', () => {
    const result = btTreeSchema.safeParse({ ...validMinimal, version: 2 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level fields (strict mode per format §2)', () => {
    const result = btTreeSchema.safeParse({ ...validMinimal, extra: 'nope' });
    expect(result.success).toBe(false);
  });

  it('rejects empty nodes array (Root must exist per format §2)', () => {
    const result = btTreeSchema.safeParse({ ...validMinimal, nodes: [] });
    expect(result.success).toBe(false);
  });

  it('rejects missing rootId', () => {
    const withoutRoot: Record<string, unknown> = { ...validMinimal };
    delete withoutRoot.rootId;
    const result = btTreeSchema.safeParse(withoutRoot);
    expect(result.success).toBe(false);
  });
});

describe('btTreeSchema — node shape', () => {
  it('rejects unknown fields on a node', () => {
    const tree = structuredClone(validMinimal);
    (tree.nodes[0]! as unknown as Record<string, unknown>).extra = true;
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects empty node id', () => {
    const tree = structuredClone(validMinimal);
    tree.nodes[0]!.id = '';
    tree.rootId = '';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects an invalid NodeKind', () => {
    const tree = structuredClone(validMinimal);
    (tree.nodes[0]! as { kind: string }).kind = 'NotAKind';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('accepts empty string for name', () => {
    const tree = structuredClone(validMinimal);
    tree.nodes[0]!.name = '';
    expect(btTreeSchema.safeParse(tree).success).toBe(true);
  });

  it('rejects non-numeric position', () => {
    const tree = structuredClone(validMinimal);
    (tree.nodes[0]!.position as { x: unknown }).x = 'left';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });
});

describe('btTreeSchema — connection shape', () => {
  it('rejects unknown fields on a connection', () => {
    const tree = structuredClone(validFiveNode);
    (tree.connections[0]! as unknown as Record<string, unknown>).extra = 1;
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects negative order', () => {
    const tree = structuredClone(validFiveNode);
    tree.connections[0]!.order = -1;
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects non-integer order', () => {
    const tree = structuredClone(validFiveNode);
    tree.connections[0]!.order = 1.5;
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects connection where childId === parentId (self-loop)', () => {
    const tree = structuredClone(validMinimal);
    tree.connections.push({ id: 'c1', parentId: 'root-1', childId: 'root-1', order: 0 });
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });
});

describe('btTreeSchema — cross-reference integrity', () => {
  it('rejects rootId that does not match any node', () => {
    const tree = structuredClone(validMinimal);
    tree.rootId = 'does-not-exist';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects rootId that points to a non-Root kind', () => {
    const tree = structuredClone(validFiveNode);
    tree.rootId = 'seq-1';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects duplicate node ids', () => {
    const tree = structuredClone(validFiveNode);
    tree.nodes[1]!.id = 'root-1';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects duplicate connection ids', () => {
    const tree = structuredClone(validFiveNode);
    tree.connections[1]!.id = tree.connections[0]!.id;
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects connection with dangling parentId', () => {
    const tree = structuredClone(validFiveNode);
    tree.connections[0]!.parentId = 'ghost';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });

  it('rejects connection with dangling childId', () => {
    const tree = structuredClone(validFiveNode);
    tree.connections[0]!.childId = 'ghost';
    expect(btTreeSchema.safeParse(tree).success).toBe(false);
  });
});

describe('btTreeSchema — error reporting', () => {
  it('reports field path for invalid kind (per format §6)', () => {
    const tree = structuredClone(validFiveNode);
    (tree.nodes[1]! as { kind: string }).kind = 'Bogus';
    const result = btTreeSchema.safeParse(tree);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.startsWith('nodes.1.kind'))).toBe(true);
    }
  });
});
