import { describe, expect, it } from 'vitest';
import type { BTConnection, BTNode } from '../../../../src/core/model/node';
import {
  moveCopySelection,
  regenerateIds,
  wouldCreateCycle,
  wouldCreateRootConflict,
} from '../../../../src/core/model/operations';

interface TestTree {
  id: string;
  name: string;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}

function node(id: string, kind: BTNode['kind'] = 'Action', x = 0, y = 0): BTNode {
  return { id, kind, name: id, position: { x, y }, properties: {} };
}

function conn(id: string, parentId: string, childId: string, order = 0): BTConnection {
  return { id, parentId, childId, order };
}

// Source: R → S, S → A (order 0), S → B (order 1). C is an unconnected node.
// Selecting {S, A, B}: S→A and S→B are internal; R→S is a boundary edge.
function makeSource(): TestTree {
  return {
    id: 'src',
    name: 'Source',
    rootId: 'R',
    nodes: [
      node('R', 'Root'),
      node('S', 'Sequence', 10, 20),
      node('A', 'Action', 30, 40),
      node('B', 'Action', 50, 60),
      node('C', 'Action', 70, 80),
    ],
    connections: [
      conn('e_RS', 'R', 'S', 0),
      conn('e_SA', 'S', 'A', 0),
      conn('e_SB', 'S', 'B', 1),
    ],
  };
}

function makeDest(): TestTree {
  return {
    id: 'dst',
    name: 'Dest',
    rootId: 'DR',
    nodes: [node('DR', 'Root')],
    connections: [],
  };
}

describe('moveCopySelection — Move', () => {
  it('removes selected nodes/edges from source and appends them to dest', () => {
    const result = moveCopySelection({
      sourceTree: makeSource(),
      destTree: makeDest(),
      selectedNodeIds: new Set(['S', 'A', 'B']),
      mode: 'move',
    });

    // Source loses S/A/B and every edge touching them (internal + boundary).
    expect(result.sourceTree.nodes.map((n) => n.id)).toEqual(['R', 'C']);
    expect(result.sourceTree.connections).toEqual([]);

    // Dest gains the three nodes + the two internal edges (ids preserved).
    expect(result.destTree.nodes.map((n) => n.id)).toEqual(['DR', 'S', 'A', 'B']);
    expect(result.destTree.connections.map((c) => c.id)).toEqual(['e_SA', 'e_SB']);

    expect(result.transferredNodeIds).toEqual(['S', 'A', 'B']);
    expect(result.droppedEdgeCount).toBe(1); // R→S
  });

  it('preserves node positions and edge order verbatim', () => {
    const result = moveCopySelection({
      sourceTree: makeSource(),
      destTree: makeDest(),
      selectedNodeIds: new Set(['S', 'A', 'B']),
      mode: 'move',
    });

    const s = result.destTree.nodes.find((n) => n.id === 'S')!;
    expect(s.position).toEqual({ x: 10, y: 20 });
    const sa = result.destTree.connections.find((c) => c.id === 'e_SA')!;
    const sb = result.destTree.connections.find((c) => c.id === 'e_SB')!;
    expect(sa.order).toBe(0);
    expect(sb.order).toBe(1);
  });

  it('includes Root in transferredNodeIds when Root is selected (validation is the modal’s job)', () => {
    const result = moveCopySelection({
      sourceTree: makeSource(),
      destTree: makeDest(),
      selectedNodeIds: new Set(['R', 'S']),
      mode: 'move',
    });

    expect(result.transferredNodeIds).toEqual(['R', 'S']);
    expect(result.destTree.nodes.map((n) => n.id)).toContain('R');
    // R→S is internal here; S→A and S→B become boundary edges.
    expect(result.destTree.connections.map((c) => c.id)).toEqual(['e_RS']);
    expect(result.droppedEdgeCount).toBe(2);
  });

  it('does not mutate the input trees', () => {
    const source = makeSource();
    const dest = makeDest();
    const sourceBefore = JSON.stringify(source);
    const destBefore = JSON.stringify(dest);

    moveCopySelection({
      sourceTree: source,
      destTree: dest,
      selectedNodeIds: new Set(['S', 'A', 'B']),
      mode: 'move',
    });

    expect(JSON.stringify(source)).toBe(sourceBefore);
    expect(JSON.stringify(dest)).toBe(destBefore);
  });
});

describe('moveCopySelection — Copy', () => {
  it('leaves source untouched (by reference) and appends new-id nodes/edges to dest', () => {
    const source = makeSource();
    const result = moveCopySelection({
      sourceTree: source,
      destTree: makeDest(),
      selectedNodeIds: new Set(['S', 'A', 'B']),
      mode: 'copy',
    });

    // Source returned by reference — identity-equal, fully unchanged.
    expect(result.sourceTree).toBe(source);

    // Dest gains three nodes; their ids are fresh (not the originals).
    const appended = result.destTree.nodes.filter((n) => n.id !== 'DR');
    expect(appended).toHaveLength(3);
    for (const n of appended) {
      expect(['S', 'A', 'B']).not.toContain(n.id);
    }
    // transferredNodeIds are the new dest ids, in selection order.
    expect(result.transferredNodeIds).toEqual(appended.map((n) => n.id));
    expect(result.destTree.connections).toHaveLength(2);
    expect(result.droppedEdgeCount).toBe(1);
  });

  it('preserves positions and edge order on copied nodes', () => {
    const result = moveCopySelection({
      sourceTree: makeSource(),
      destTree: makeDest(),
      selectedNodeIds: new Set(['S', 'A', 'B']),
      mode: 'copy',
    });
    const copiedS = result.destTree.nodes.find((n) => n.name === 'S')!;
    expect(copiedS.position).toEqual({ x: 10, y: 20 });
    const orders = result.destTree.connections.map((c) => c.order).sort();
    expect(orders).toEqual([0, 1]);
  });
});

describe('moveCopySelection — no-op', () => {
  it('returns both trees by reference on empty selection', () => {
    const source = makeSource();
    const dest = makeDest();
    const result = moveCopySelection({
      sourceTree: source,
      destTree: dest,
      selectedNodeIds: new Set(),
      mode: 'move',
    });
    expect(result.sourceTree).toBe(source);
    expect(result.destTree).toBe(dest);
    expect(result.transferredNodeIds).toEqual([]);
    expect(result.droppedEdgeCount).toBe(0);
  });

  it('ignores unknown ids (returns by reference when none resolve)', () => {
    const source = makeSource();
    const dest = makeDest();
    const result = moveCopySelection({
      sourceTree: source,
      destTree: dest,
      selectedNodeIds: new Set(['ghost1', 'ghost2']),
      mode: 'copy',
    });
    expect(result.sourceTree).toBe(source);
    expect(result.destTree).toBe(dest);
    expect(result.transferredNodeIds).toEqual([]);
  });
});

describe('wouldCreateRootConflict (V1)', () => {
  const dest = makeDest(); // has a Root (DR)
  it('is true when the selection contains a Root and the dest has one', () => {
    expect(wouldCreateRootConflict(makeSource(), new Set(['R', 'S']), dest)).toBe(true);
  });
  it('is false when the selection has no Root', () => {
    expect(wouldCreateRootConflict(makeSource(), new Set(['S', 'A']), dest)).toBe(false);
  });
});

describe('wouldCreateCycle (V2)', () => {
  function sourceWithSubtree(): TestTree {
    const t = makeSource();
    t.nodes.push({
      id: 'sub',
      kind: 'SubTree',
      name: 'B',
      position: { x: 0, y: 0 },
      properties: {},
      treeRef: 'B',
    });
    return t;
  }
  it('is true when a selected SubTree references the destination by name', () => {
    expect(wouldCreateCycle(sourceWithSubtree(), new Set(['sub']), 'B')).toBe(true);
  });
  it('is false when the SubTree references a different tree', () => {
    expect(wouldCreateCycle(sourceWithSubtree(), new Set(['sub']), 'C')).toBe(false);
  });
  it('is false when the referencing SubTree is not selected', () => {
    expect(wouldCreateCycle(sourceWithSubtree(), new Set(['S']), 'B')).toBe(false);
  });
});

describe('regenerateIds', () => {
  it('mints fresh node + edge ids and remaps parent/child through the id-map', () => {
    const nodes = [node('S', 'Sequence', 1, 2), node('A', 'Action', 3, 4)];
    const connections = [conn('e1', 'S', 'A', 5)];

    const out = regenerateIds(nodes, connections);

    expect(out.nodes.map((n) => n.id)).not.toEqual(['S', 'A']);
    expect(out.idMap.get('S')).toBe(out.nodes[0]!.id);
    expect(out.idMap.get('A')).toBe(out.nodes[1]!.id);
    const e = out.connections[0]!;
    expect(e.id).not.toBe('e1');
    expect(e.parentId).toBe(out.idMap.get('S'));
    expect(e.childId).toBe(out.idMap.get('A'));
    expect(e.order).toBe(5);
    // Positions are cloned, not shared with the input.
    expect(out.nodes[0]!.position).toEqual({ x: 1, y: 2 });
    expect(out.nodes[0]!.position).not.toBe(nodes[0]!.position);
  });
});
