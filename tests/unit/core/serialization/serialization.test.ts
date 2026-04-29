import { describe, expect, it } from 'vitest';
import type { BehaviorTree, BTDocument } from '../../../../src/core/model/node';
import { reorderChildren } from '../../../../src/core/model/operations';
import { serialize } from '../../../../src/core/serialization/serialize';
import { deserialize } from '../../../../src/core/serialization/deserialize';
import { migrateV1toV2 } from '../../../../src/core/serialization/migrate';

const fiveNodeV1: BehaviorTree = {
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

// Build a deterministic v2 document by migrating fiveNodeV1 with a fixed name.
// Each call produces a fresh treeId; tests that need byte-identical output
// reuse the same `fiveNodeDoc` instance.
const fiveNodeDoc: BTDocument = migrateV1toV2(fiveNodeV1, { name: 'Main' });

const twoTreeDoc: BTDocument = {
  version: 2,
  mainTreeId: 'tree-main',
  trees: [
    {
      id: 'tree-main',
      name: 'Main',
      rootId: 'root-main',
      nodes: [
        { id: 'root-main', kind: 'Root', name: 'Root', position: { x: 0, y: 0 }, properties: {} },
        {
          id: 'sub-1',
          kind: 'SubTree',
          name: 'use-helper',
          position: { x: 0, y: 100 },
          properties: {},
          treeRef: 'Helper',
        },
      ],
      connections: [
        { id: 'c1', parentId: 'root-main', childId: 'sub-1', order: 0 },
      ],
    },
    {
      id: 'tree-helper',
      name: 'Helper',
      rootId: 'root-helper',
      nodes: [
        { id: 'root-helper', kind: 'Root', name: 'Root', position: { x: 0, y: 0 }, properties: {} },
      ],
      connections: [],
    },
  ],
};

describe('serialize', () => {
  it('produces pretty-printed JSON with 2-space indent (format §1)', () => {
    const out = serialize(fiveNodeDoc);
    expect(out).toContain('\n  "version": 2');
    expect(out).toContain('\n  "mainTreeId"');
  });

  it('emits top-level keys in canonical order: version, mainTreeId, trees', () => {
    const out = serialize(fiveNodeDoc);
    const vi = out.indexOf('"version"');
    const mi = out.indexOf('"mainTreeId"');
    const ti = out.indexOf('"trees"');
    expect(vi).toBeGreaterThanOrEqual(0);
    expect(vi).toBeLessThan(mi);
    expect(mi).toBeLessThan(ti);
  });

  it('emits per-tree keys in canonical order: id, name, rootId, nodes, connections', () => {
    const out = serialize(fiveNodeDoc);
    const treeBlock = out.slice(out.indexOf('"trees"'));
    expect(treeBlock.indexOf('"id"')).toBeLessThan(treeBlock.indexOf('"name"'));
    expect(treeBlock.indexOf('"name"')).toBeLessThan(treeBlock.indexOf('"rootId"'));
    expect(treeBlock.indexOf('"rootId"')).toBeLessThan(treeBlock.indexOf('"nodes"'));
    expect(treeBlock.indexOf('"nodes"')).toBeLessThan(treeBlock.indexOf('"connections"'));
  });

  it('emits node keys in canonical order: id, kind, name, position, properties', () => {
    const out = serialize(fiveNodeDoc);
    const nodeBlock = out.slice(out.indexOf('"nodes"'), out.indexOf('"connections"'));
    expect(nodeBlock.indexOf('"id"')).toBeLessThan(nodeBlock.indexOf('"kind"'));
    expect(nodeBlock.indexOf('"kind"')).toBeLessThan(nodeBlock.indexOf('"name"'));
    expect(nodeBlock.indexOf('"name"')).toBeLessThan(nodeBlock.indexOf('"position"'));
    expect(nodeBlock.indexOf('"position"')).toBeLessThan(nodeBlock.indexOf('"properties"'));
  });

  it('emits connection keys in canonical order: id, parentId, childId, order', () => {
    const out = serialize(fiveNodeDoc);
    const connBlock = out.slice(out.indexOf('"connections"'));
    expect(connBlock.indexOf('"id"')).toBeLessThan(connBlock.indexOf('"parentId"'));
    expect(connBlock.indexOf('"parentId"')).toBeLessThan(connBlock.indexOf('"childId"'));
    expect(connBlock.indexOf('"childId"')).toBeLessThan(connBlock.indexOf('"order"'));
  });

  it('emits SubTree treeRef after properties, when present', () => {
    const out = serialize(twoTreeDoc);
    const subBlock = out.slice(out.indexOf('"sub-1"'));
    expect(subBlock).toContain('"treeRef": "Helper"');
    // properties precedes treeRef
    expect(subBlock.indexOf('"properties"')).toBeLessThan(subBlock.indexOf('"treeRef"'));
  });

  it('omits treeRef on non-SubTree nodes (no empty key in output)', () => {
    const out = serialize(fiveNodeDoc);
    expect(out).not.toContain('"treeRef"');
  });

  it('normalizes key order even when input has keys in a different order', () => {
    const scrambled: BTDocument = {
      trees: fiveNodeDoc.trees.map((t) => ({
        connections: t.connections.map((c) => ({
          order: c.order,
          childId: c.childId,
          parentId: c.parentId,
          id: c.id,
        })),
        nodes: t.nodes.map((n) => ({
          properties: n.properties,
          position: n.position,
          name: n.name,
          kind: n.kind,
          id: n.id,
        })),
        rootId: t.rootId,
        name: t.name,
        id: t.id,
      })),
      mainTreeId: fiveNodeDoc.mainTreeId,
      version: 2,
    };
    expect(serialize(scrambled)).toBe(serialize(fiveNodeDoc));
  });
});

describe('deserialize — v2 round-trip', () => {
  it('parses a serialized v2 document into a deep-equal structure', () => {
    const json = serialize(fiveNodeDoc);
    const result = deserialize(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document).toEqual(fiveNodeDoc);
    }
  });

  it('preserves reordered sibling order through save→load', () => {
    const reorderedTree = reorderChildren(fiveNodeV1, 'seq-1', [
      'a-grab',
      'a-move',
      'c-sees',
    ]);
    const doc = migrateV1toV2(reorderedTree);
    const loaded = deserialize(serialize(doc));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const bySibling = new Map(
      loaded.document.trees[0]!.connections
        .filter((c) => c.parentId === 'seq-1')
        .map((c) => [c.childId, c.order]),
    );
    expect(bySibling.get('a-grab')).toBe(0);
    expect(bySibling.get('a-move')).toBe(1);
    expect(bySibling.get('c-sees')).toBe(2);
  });

  it('save → load → save is byte-identical for v2 (format §4.1 invariant)', () => {
    const first = serialize(fiveNodeDoc);
    const parsed = deserialize(first);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(serialize(parsed.document)).toBe(first);
    }
  });

  it('preserves non-contiguous order values (no renumbering)', () => {
    const sparse = structuredClone(fiveNodeDoc);
    sparse.trees[0]!.connections[1]!.order = 5;
    sparse.trees[0]!.connections[2]!.order = 10;
    sparse.trees[0]!.connections[3]!.order = 20;
    const result = deserialize(serialize(sparse));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const conns = result.document.trees[0]!.connections;
      expect(conns[1]!.order).toBe(5);
      expect(conns[2]!.order).toBe(10);
      expect(conns[3]!.order).toBe(20);
    }
  });

  it('round-trips a multi-tree document with SubTree references', () => {
    const result = deserialize(serialize(twoTreeDoc));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document).toEqual(twoTreeDoc);
    }
  });
});

describe('deserialize — v1 auto-migration', () => {
  it('reads a v1 file and returns a v2 document (data preserved)', () => {
    const v1Json = JSON.stringify(fiveNodeV1, null, 2) + '\n';
    const result = deserialize(v1Json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.version).toBe(2);
      expect(result.document.trees).toHaveLength(1);
      const tree = result.document.trees[0]!;
      expect(tree.rootId).toBe(fiveNodeV1.rootId);
      expect(tree.nodes).toEqual(fiveNodeV1.nodes);
      expect(tree.connections).toEqual(fiveNodeV1.connections);
    }
  });

  it('round-trip: v1 file → open (migrate) → save produces a valid v2 file', () => {
    const v1Json = JSON.stringify(fiveNodeV1, null, 2) + '\n';
    const opened = deserialize(v1Json);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const saved = serialize(opened.document);
    expect(saved.startsWith('{\n  "version": 2')).toBe(true);
    // and the saved file re-opens identically (v2 round-trip)
    const reopened = deserialize(saved);
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(reopened.document).toEqual(opened.document);
    }
  });
});

describe('deserialize — error paths', () => {
  it('returns kind=parse on malformed JSON', () => {
    const result = deserialize('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'parse') {
      expect(result.error.message).toMatch(/json/i);
    } else {
      throw new Error('expected a parse error');
    }
  });

  it('returns kind=schema with field paths for invalid v2 content', () => {
    const bad = {
      version: 2,
      mainTreeId: 'ghost',
      trees: [
        {
          id: 'tree-1',
          name: 'Main',
          rootId: 'root-1',
          nodes: [
            { id: 'root-1', kind: 'Root', name: '', position: { x: 0, y: 0 }, properties: {} },
          ],
          connections: [],
        },
      ],
    };
    const result = deserialize(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'schema') {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0]!.path).toBeDefined();
    } else {
      throw new Error('expected a schema error');
    }
  });

  it('returns kind=schema for an invalid v1 input (validates before migrating)', () => {
    const badV1 = {
      version: 1,
      rootId: 'ghost',
      nodes: [
        { id: 'r', kind: 'Root', name: 'Root', position: { x: 0, y: 0 }, properties: {} },
      ],
      connections: [],
    };
    const result = deserialize(JSON.stringify(badV1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('schema');
    }
  });

  it('returns kind=unsupported-version for genuinely unknown versions', () => {
    const result = deserialize(JSON.stringify({ version: 99, mainTreeId: 'x', trees: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('unsupported-version');
    }
  });
});
