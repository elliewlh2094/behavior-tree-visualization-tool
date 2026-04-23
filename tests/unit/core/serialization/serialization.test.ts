import { describe, expect, it } from 'vitest';
import type { BehaviorTree } from '../../../../src/core/model/node';
import { serialize } from '../../../../src/core/serialization/serialize';
import { deserialize } from '../../../../src/core/serialization/deserialize';

const fiveNodeTree: BehaviorTree = {
  version: 1,
  rootId: 'root-1',
  nodes: [
    { id: 'root-1', kind: 'Root', name: 'Root', position: { x: 400, y: 80 }, properties: {} },
    { id: 'seq-1', kind: 'Sequence', name: 'Pick up', position: { x: 400, y: 200 }, properties: {} },
    { id: 'a-move', kind: 'Action', name: 'Move', position: { x: 240, y: 320 }, properties: {} },
    { id: 'c-sees', kind: 'Condition', name: 'Sees target', position: { x: 400, y: 320 }, properties: {} },
    { id: 'a-grab', kind: 'Action', name: 'Grab', position: { x: 560, y: 320 }, properties: {} },
  ],
  connections: [
    { id: 'c1', parentId: 'root-1', childId: 'seq-1', order: 0 },
    { id: 'c2', parentId: 'seq-1', childId: 'a-move', order: 0 },
    { id: 'c3', parentId: 'seq-1', childId: 'c-sees', order: 1 },
    { id: 'c4', parentId: 'seq-1', childId: 'a-grab', order: 2 },
  ],
};

describe('serialize', () => {
  it('produces pretty-printed JSON with 2-space indent (format §1)', () => {
    const out = serialize(fiveNodeTree);
    expect(out).toContain('\n  "version": 1');
    expect(out).toContain('\n  "rootId"');
  });

  it('emits top-level keys in canonical order: version, rootId, nodes, connections', () => {
    const out = serialize(fiveNodeTree);
    const vi = out.indexOf('"version"');
    const ri = out.indexOf('"rootId"');
    const ni = out.indexOf('"nodes"');
    const ci = out.indexOf('"connections"');
    expect(vi).toBeGreaterThanOrEqual(0);
    expect(vi).toBeLessThan(ri);
    expect(ri).toBeLessThan(ni);
    expect(ni).toBeLessThan(ci);
  });

  it('emits node keys in canonical order: id, kind, name, position, properties', () => {
    const out = serialize(fiveNodeTree);
    const nodeBlock = out.slice(out.indexOf('"nodes"'), out.indexOf('"connections"'));
    expect(nodeBlock.indexOf('"id"')).toBeLessThan(nodeBlock.indexOf('"kind"'));
    expect(nodeBlock.indexOf('"kind"')).toBeLessThan(nodeBlock.indexOf('"name"'));
    expect(nodeBlock.indexOf('"name"')).toBeLessThan(nodeBlock.indexOf('"position"'));
    expect(nodeBlock.indexOf('"position"')).toBeLessThan(nodeBlock.indexOf('"properties"'));
  });

  it('emits connection keys in canonical order: id, parentId, childId, order', () => {
    const out = serialize(fiveNodeTree);
    const connBlock = out.slice(out.indexOf('"connections"'));
    expect(connBlock.indexOf('"id"')).toBeLessThan(connBlock.indexOf('"parentId"'));
    expect(connBlock.indexOf('"parentId"')).toBeLessThan(connBlock.indexOf('"childId"'));
    expect(connBlock.indexOf('"childId"')).toBeLessThan(connBlock.indexOf('"order"'));
  });

  it('normalizes key order even when input has keys in a different order', () => {
    const scrambled: BehaviorTree = {
      connections: fiveNodeTree.connections.map((c) => ({
        order: c.order,
        childId: c.childId,
        parentId: c.parentId,
        id: c.id,
      })),
      nodes: fiveNodeTree.nodes.map((n) => ({
        properties: n.properties,
        position: n.position,
        name: n.name,
        kind: n.kind,
        id: n.id,
      })),
      rootId: fiveNodeTree.rootId,
      version: 1,
    };
    const a = serialize(scrambled);
    const b = serialize(fiveNodeTree);
    expect(a).toBe(b);
  });
});

describe('deserialize', () => {
  it('parses a serialized tree into a deep-equal structure (round-trip)', () => {
    const json = serialize(fiveNodeTree);
    const result = deserialize(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tree).toEqual(fiveNodeTree);
    }
  });

  it('save → load → save is byte-identical (format §4.1 invariant)', () => {
    const first = serialize(fiveNodeTree);
    const parsed = deserialize(first);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const second = serialize(parsed.tree);
      expect(second).toBe(first);
    }
  });

  it('returns an error (not throw) on malformed JSON', () => {
    const result = deserialize('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'parse') {
      expect(result.error.message).toMatch(/json/i);
    } else {
      throw new Error('expected a parse error');
    }
  });

  it('returns a schema error with field paths when zod rejects the content', () => {
    const badTree = {
      version: 1,
      rootId: 'missing',
      nodes: [
        { id: 'other', kind: 'Root', name: '', position: { x: 0, y: 0 }, properties: {} },
      ],
      connections: [],
    };
    const result = deserialize(JSON.stringify(badTree));
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'schema') {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0]!.path).toBeDefined();
    } else {
      throw new Error('expected a schema error');
    }
  });

  it('rejects unsupported version values', () => {
    const badTree = { ...fiveNodeTree, version: 2 };
    const result = deserialize(JSON.stringify(badTree));
    expect(result.ok).toBe(false);
  });

  it('preserves non-contiguous order values (format §4.1 — no renumbering)', () => {
    const sparse: BehaviorTree = structuredClone(fiveNodeTree);
    sparse.connections[1]!.order = 5;
    sparse.connections[2]!.order = 10;
    sparse.connections[3]!.order = 20;
    const result = deserialize(serialize(sparse));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tree.connections[1]!.order).toBe(5);
      expect(result.tree.connections[2]!.order).toBe(10);
      expect(result.tree.connections[3]!.order).toBe(20);
    }
  });
});
