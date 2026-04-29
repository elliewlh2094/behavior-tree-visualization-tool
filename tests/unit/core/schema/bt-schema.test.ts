import { describe, expect, it } from 'vitest';
import {
  btDocumentSchemaV2,
  btTreeSchema,
  parseBTDocument,
} from '../../../../src/core/schema/bt-schema';
import type { BehaviorTree, BTDocument } from '../../../../src/core/model/node';

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

// ──────────────────────────────────────────────────────────────────────────
// v2: BTDocument schema and parseBTDocument
// ──────────────────────────────────────────────────────────────────────────

const validV2Single: BTDocument = {
  version: 2,
  mainTreeId: 'tree-1',
  trees: [
    {
      id: 'tree-1',
      name: 'Main',
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
    },
  ],
};

const validV2TwoTrees: BTDocument = {
  version: 2,
  mainTreeId: 'tree-main',
  trees: [
    {
      id: 'tree-main',
      name: 'Main',
      rootId: 'root-main',
      nodes: [
        {
          id: 'root-main',
          kind: 'Root',
          name: 'Root',
          position: { x: 0, y: 0 },
          properties: {},
        },
        {
          id: 'sub-ref',
          kind: 'SubTree',
          name: 'use-helper',
          position: { x: 0, y: 100 },
          properties: {},
          treeRef: 'Helper',
        },
      ],
      connections: [
        { id: 'c1', parentId: 'root-main', childId: 'sub-ref', order: 0 },
      ],
    },
    {
      id: 'tree-helper',
      name: 'Helper',
      rootId: 'root-helper',
      nodes: [
        {
          id: 'root-helper',
          kind: 'Root',
          name: 'Root',
          position: { x: 0, y: 0 },
          properties: {},
        },
      ],
      connections: [],
    },
  ],
};

describe('btDocumentSchemaV2 — happy path', () => {
  it('accepts a single-tree v2 document', () => {
    expect(btDocumentSchemaV2.safeParse(validV2Single).success).toBe(true);
  });

  it('accepts a multi-tree v2 document with a SubTree reference', () => {
    expect(btDocumentSchemaV2.safeParse(validV2TwoTrees).success).toBe(true);
  });
});

describe('btDocumentSchemaV2 — top-level shape', () => {
  it('rejects version other than 2', () => {
    const doc = { ...validV2Single, version: 1 };
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });

  it('rejects unknown top-level fields (strict)', () => {
    const doc = { ...validV2Single, extra: 'nope' };
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });

  it('rejects empty trees array', () => {
    const doc = { ...validV2Single, trees: [] };
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });

  it('rejects missing mainTreeId', () => {
    const partial: Record<string, unknown> = { ...validV2Single };
    delete partial.mainTreeId;
    expect(btDocumentSchemaV2.safeParse(partial).success).toBe(false);
  });
});

describe('btDocumentSchemaV2 — cross-tree integrity', () => {
  it('rejects mainTreeId that does not match any tree', () => {
    const doc = { ...validV2Single, mainTreeId: 'ghost' };
    const result = btDocumentSchemaV2.safeParse(doc);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'mainTreeId')).toBe(true);
    }
  });

  it('rejects duplicate tree ids', () => {
    const doc = structuredClone(validV2TwoTrees);
    doc.trees[1]!.id = doc.trees[0]!.id;
    doc.mainTreeId = doc.trees[0]!.id;
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });

  it('rejects duplicate tree names (treeRef references by name)', () => {
    const doc = structuredClone(validV2TwoTrees);
    doc.trees[1]!.name = doc.trees[0]!.name;
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });

  it('delegates per-tree integrity to checkTreeIntegrity (rootId must point at Root)', () => {
    const doc = structuredClone(validV2TwoTrees);
    doc.trees[0]!.rootId = 'sub-ref'; // a SubTree, not a Root
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });
});

describe('btNodeSchema — SubTree treeRef requirement', () => {
  it('rejects SubTree node without treeRef', () => {
    const doc = structuredClone(validV2TwoTrees);
    delete (doc.trees[0]!.nodes[1]! as { treeRef?: string }).treeRef;
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });

  it('rejects SubTree node with empty treeRef', () => {
    const doc = structuredClone(validV2TwoTrees);
    doc.trees[0]!.nodes[1]!.treeRef = '';
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(false);
  });

  it('accepts non-SubTree node without treeRef (no false positive)', () => {
    const doc = structuredClone(validV2Single);
    expect(doc.trees[0]!.nodes[0]!.treeRef).toBeUndefined();
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(true);
  });
});

describe('parseBTDocument', () => {
  it('returns ok with the parsed document for a valid v2 input', () => {
    const result = parseBTDocument(validV2Single);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.mainTreeId).toBe('tree-1');
      expect(result.document.trees).toHaveLength(1);
    }
  });

  it('returns kind=schema for a malformed v2 input', () => {
    const broken = { ...validV2Single, mainTreeId: 'ghost' };
    const result = parseBTDocument(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('schema');
    }
  });

  it('migrates a valid v1 input into a v2 document (T3)', () => {
    const v1: BehaviorTree = {
      version: 1,
      rootId: 'r',
      nodes: [
        { id: 'r', kind: 'Root', name: 'Root', position: { x: 0, y: 0 }, properties: {} },
      ],
      connections: [],
    };
    const result = parseBTDocument(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.version).toBe(2);
      expect(result.document.trees).toHaveLength(1);
      expect(result.document.trees[0]!.rootId).toBe('r');
      expect(result.document.mainTreeId).toBe(result.document.trees[0]!.id);
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
    const result = parseBTDocument(badV1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('schema');
    }
  });

  it('returns kind=parse for a non-object input', () => {
    expect(parseBTDocument(null).ok).toBe(false);
    expect(parseBTDocument('string').ok).toBe(false);
    expect(parseBTDocument([]).ok).toBe(false);
  });

  it('returns kind=unsupported-version for an unknown version', () => {
    const result = parseBTDocument({ version: 99, mainTreeId: 'x', trees: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('unsupported-version');
    }
  });
});
