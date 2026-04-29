import { describe, expect, it } from 'vitest';
import { migrateV1toV2 } from '../../../../src/core/serialization/migrate';
import { btDocumentSchemaV2 } from '../../../../src/core/schema/bt-schema';
import type { BehaviorTree } from '../../../../src/core/model/node';

const minimalV1: BehaviorTree = {
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

describe('migrateV1toV2', () => {
  it('produces a valid v2 document that passes btDocumentSchemaV2', () => {
    const doc = migrateV1toV2(minimalV1);
    expect(btDocumentSchemaV2.safeParse(doc).success).toBe(true);
  });

  it('produces version: 2 and a single tree', () => {
    const doc = migrateV1toV2(minimalV1);
    expect(doc.version).toBe(2);
    expect(doc.trees).toHaveLength(1);
  });

  it('mainTreeId references the migrated tree', () => {
    const doc = migrateV1toV2(minimalV1);
    expect(doc.mainTreeId).toBe(doc.trees[0]!.id);
  });

  it('uses default name "Main" when no name is supplied', () => {
    const doc = migrateV1toV2(minimalV1);
    expect(doc.trees[0]!.name).toBe('Main');
  });

  it('honors a custom name via opts', () => {
    const doc = migrateV1toV2(minimalV1, { name: 'Robot Pickup' });
    expect(doc.trees[0]!.name).toBe('Robot Pickup');
  });

  it('falls back to "Main" when the supplied name is empty or whitespace', () => {
    expect(migrateV1toV2(minimalV1, { name: '' }).trees[0]!.name).toBe('Main');
    expect(migrateV1toV2(minimalV1, { name: '   ' }).trees[0]!.name).toBe('Main');
  });

  it('preserves rootId, nodes, and connections (no data loss)', () => {
    const doc = migrateV1toV2(fiveNodeV1);
    const tree = doc.trees[0]!;
    expect(tree.rootId).toBe(fiveNodeV1.rootId);
    expect(tree.nodes).toEqual(fiveNodeV1.nodes);
    expect(tree.connections).toEqual(fiveNodeV1.connections);
  });

  it('generates a fresh treeId distinct from the rootId', () => {
    const doc = migrateV1toV2(minimalV1);
    expect(doc.mainTreeId).not.toBe(minimalV1.rootId);
  });

  it('produces independent treeIds across calls', () => {
    const a = migrateV1toV2(minimalV1);
    const b = migrateV1toV2(minimalV1);
    expect(a.mainTreeId).not.toBe(b.mainTreeId);
  });
});
