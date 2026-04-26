import { describe, expect, it } from 'vitest';
import {
  computeTreeLayout,
  type LayoutOptions,
} from '../../../../src/core/layout/tree-layout';
import type {
  BehaviorTree,
  BTConnection,
  BTNode,
  NodeKind,
} from '../../../../src/core/model/node';

const OPTS: LayoutOptions = {
  gridSize: 25,
  nodeWidth: 150,
  nodeHeight: 75,
  gapX: 50,
  gapY: 50,
};

const SLOT_W = OPTS.nodeWidth + OPTS.gapX; // 200
const LEVEL_H = OPTS.nodeHeight + OPTS.gapY; // 125

function makeNode(id: string, kind: NodeKind = 'Action'): BTNode {
  return { id, kind, name: id, position: { x: 0, y: 0 }, properties: {} };
}

function makeConn(id: string, parentId: string, childId: string, order: number): BTConnection {
  return { id, parentId, childId, order };
}

function makeTree(rootId: string, nodes: BTNode[], connections: BTConnection[]): BehaviorTree {
  return { version: 1, rootId, nodes, connections };
}

describe('computeTreeLayout', () => {
  it('places a single Root at the origin, snapped to grid', () => {
    const tree = makeTree('r', [makeNode('r', 'Root')], []);
    const positions = computeTreeLayout(tree, OPTS);
    expect(positions.size).toBe(1);
    expect(positions.get('r')).toEqual({ x: 0, y: 0 });
  });

  it('places 3 children in a row below Root, ordered left-to-right by connection order', () => {
    const tree = makeTree(
      'r',
      [makeNode('r', 'Root'), makeNode('a'), makeNode('b'), makeNode('c')],
      [
        makeConn('e1', 'r', 'a', 2),
        makeConn('e2', 'r', 'b', 0),
        makeConn('e3', 'r', 'c', 1),
      ],
    );
    const positions = computeTreeLayout(tree, OPTS);
    // sorted by order: b (0), c (1), a (2) → leftmost to rightmost
    expect(positions.get('b')).toEqual({ x: 0, y: LEVEL_H });
    expect(positions.get('c')).toEqual({ x: SLOT_W, y: LEVEL_H });
    expect(positions.get('a')).toEqual({ x: 2 * SLOT_W, y: LEVEL_H });
    // Root centered over its children
    expect(positions.get('r')).toEqual({ x: SLOT_W, y: 0 });
  });

  it('positions a deep tree with each level offset by nodeHeight + gapY', () => {
    // r → (a → (a1, a2)), (b)
    const tree = makeTree(
      'r',
      [
        makeNode('r', 'Root'),
        makeNode('a'),
        makeNode('b'),
        makeNode('a1'),
        makeNode('a2'),
      ],
      [
        makeConn('e1', 'r', 'a', 0),
        makeConn('e2', 'r', 'b', 1),
        makeConn('e3', 'a', 'a1', 0),
        makeConn('e4', 'a', 'a2', 1),
      ],
    );
    const positions = computeTreeLayout(tree, OPTS);
    expect(positions.get('r')!.y).toBe(0);
    expect(positions.get('a')!.y).toBe(LEVEL_H);
    expect(positions.get('b')!.y).toBe(LEVEL_H);
    expect(positions.get('a1')!.y).toBe(2 * LEVEL_H);
    expect(positions.get('a2')!.y).toBe(2 * LEVEL_H);
    // a1, a2 take the first two leaf slots; b takes the third
    expect(positions.get('a1')!.x).toBe(0);
    expect(positions.get('a2')!.x).toBe(SLOT_W);
    expect(positions.get('b')!.x).toBe(2 * SLOT_W);
    // a centered over a1, a2
    expect(positions.get('a')!.x).toBe(SLOT_W / 2);
    // No horizontal collision between sibling subtrees
    expect(positions.get('b')!.x).toBeGreaterThan(positions.get('a2')!.x);
  });

  it('snaps every output position to gridSize', () => {
    const tree = makeTree(
      'r',
      [makeNode('r', 'Root'), makeNode('a'), makeNode('b'), makeNode('c')],
      [
        makeConn('e1', 'r', 'a', 0),
        makeConn('e2', 'r', 'b', 1),
        makeConn('e3', 'r', 'c', 2),
      ],
    );
    const positions = computeTreeLayout(tree, OPTS);
    for (const { x, y } of positions.values()) {
      expect(x % OPTS.gridSize).toBe(0);
      expect(y % OPTS.gridSize).toBe(0);
    }
  });

  it('snaps centered internal nodes when the midpoint lies between grid lines', () => {
    // gridSize 30 with two children at x=0 and x=180 (snapped).
    // slotWidth = 30+30 = 60; child1 at 0, child2 at 60. Midpoint 30. Snapped: 30.
    // To force off-grid midpoint, use 3 children: c1=0, c2=60, c3=120 → root midpoint 60.
    // Use gridSize=20 with nodeWidth=30, gapX=30 → slotWidth=60. Two children: midpoint 30, off the 20-grid → snaps to 20 or 40.
    const opts: LayoutOptions = { gridSize: 20, nodeWidth: 30, nodeHeight: 30, gapX: 30, gapY: 30 };
    const tree = makeTree(
      'r',
      [makeNode('r', 'Root'), makeNode('a'), makeNode('b')],
      [makeConn('e1', 'r', 'a', 0), makeConn('e2', 'r', 'b', 1)],
    );
    const positions = computeTreeLayout(tree, opts);
    for (const { x, y } of positions.values()) {
      expect(x % opts.gridSize).toBe(0);
      expect(y % opts.gridSize).toBe(0);
    }
  });

  it('places orphans in a column to the right of the main tree', () => {
    const tree = makeTree(
      'r',
      [
        makeNode('r', 'Root'),
        makeNode('a'),
        makeNode('b'),
        makeNode('orphan1'),
        makeNode('orphan2'),
      ],
      [makeConn('e1', 'r', 'a', 0), makeConn('e2', 'r', 'b', 1)],
    );
    const positions = computeTreeLayout(tree, OPTS);
    const mainMaxX = Math.max(
      positions.get('r')!.x,
      positions.get('a')!.x,
      positions.get('b')!.x,
    );
    const o1 = positions.get('orphan1')!;
    const o2 = positions.get('orphan2')!;
    expect(o1.x).toBeGreaterThan(mainMaxX);
    expect(o2.x).toBe(o1.x); // same column
    expect(o1.y).toBe(0);
    expect(o2.y).toBe(LEVEL_H);
  });

  it('does not mutate the input tree (positions, connections, or order values)', () => {
    const tree = makeTree(
      'r',
      [makeNode('r', 'Root'), makeNode('a'), makeNode('b')],
      [makeConn('e1', 'r', 'a', 5), makeConn('e2', 'r', 'b', 3)],
    );
    const snapshot = JSON.parse(JSON.stringify(tree));
    computeTreeLayout(tree, OPTS);
    expect(tree).toEqual(snapshot);
  });

  it('handles a tree with only Root and no connections', () => {
    const tree = makeTree('r', [makeNode('r', 'Root')], []);
    const positions = computeTreeLayout(tree, OPTS);
    expect(positions.size).toBe(1);
    expect(positions.get('r')).toEqual({ x: 0, y: 0 });
  });

  it('handles a tree where Root has only orphans (no children)', () => {
    const tree = makeTree(
      'r',
      [makeNode('r', 'Root'), makeNode('o1'), makeNode('o2')],
      [],
    );
    const positions = computeTreeLayout(tree, OPTS);
    expect(positions.get('r')).toEqual({ x: 0, y: 0 });
    // Orphans go to the right of root (max x = 0, so orphanX = slotWidth)
    expect(positions.get('o1')).toEqual({ x: SLOT_W, y: 0 });
    expect(positions.get('o2')).toEqual({ x: SLOT_W, y: LEVEL_H });
  });
});
