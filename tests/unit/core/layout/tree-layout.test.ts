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
    // Root anchored to its user position (0, 0); the row of 3 children shifts
    // left so the middle child sits directly under Root.
    expect(positions.get('r')).toEqual({ x: 0, y: 0 });
    // Sibling order: b (0) leftmost → c (1) → a (2) rightmost
    expect(positions.get('b')).toEqual({ x: -SLOT_W, y: LEVEL_H });
    expect(positions.get('c')).toEqual({ x: 0, y: LEVEL_H });
    expect(positions.get('a')).toEqual({ x: SLOT_W, y: LEVEL_H });
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
    // Root anchored at user (0,0); subtree shifts so Root's natural midpoint
    // (between subtree of 'a' and leaf 'b') ends up at x=0.
    expect(positions.get('r')).toEqual({ x: 0, y: 0 });
    // Each level offset by LEVEL_H below Root
    expect(positions.get('a')!.y).toBe(LEVEL_H);
    expect(positions.get('b')!.y).toBe(LEVEL_H);
    expect(positions.get('a1')!.y).toBe(2 * LEVEL_H);
    expect(positions.get('a2')!.y).toBe(2 * LEVEL_H);
    // Leaf x-order matches DFS pre-order: a1 < a2 < b
    expect(positions.get('a1')!.x).toBeLessThan(positions.get('a2')!.x);
    expect(positions.get('a2')!.x).toBeLessThan(positions.get('b')!.x);
    // Internal node 'a' centered over its children a1, a2
    const aMid = (positions.get('a1')!.x + positions.get('a2')!.x) / 2;
    expect(positions.get('a')!.x).toBe(aMid);
    // Sibling subtrees don't horizontally collide
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
      // Math.abs to normalize JS's signed-zero behavior on `(-200) % 25 === -0`.
      expect(Math.abs(x % OPTS.gridSize)).toBe(0);
      expect(Math.abs(y % OPTS.gridSize)).toBe(0);
    }
  });

  it('snaps centered internal nodes when the midpoint lies between grid lines', () => {
    // gridSize=20 with nodeWidth=30, gapX=30 → slotWidth=60. Two children
    // at relative x=0 and 60; midpoint 30 — off the 20-grid; snaps to 20 or 40.
    const opts: LayoutOptions = { gridSize: 20, nodeWidth: 30, nodeHeight: 30, gapX: 30, gapY: 30 };
    const tree = makeTree(
      'r',
      [makeNode('r', 'Root'), makeNode('a'), makeNode('b')],
      [makeConn('e1', 'r', 'a', 0), makeConn('e2', 'r', 'b', 1)],
    );
    const positions = computeTreeLayout(tree, opts);
    for (const { x, y } of positions.values()) {
      expect(Math.abs(x % opts.gridSize)).toBe(0);
      expect(Math.abs(y % opts.gridSize)).toBe(0);
    }
  });

  it('places orphans in a row directly above Root, starting at Root x', () => {
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
    const root = positions.get('r')!;
    const o1 = positions.get('orphan1')!;
    const o2 = positions.get('orphan2')!;
    expect(o1.y).toBe(root.y - LEVEL_H);
    expect(o2.y).toBe(root.y - LEVEL_H);
    expect(o1.x).toBe(root.x);
    expect(o2.x).toBe(root.x + SLOT_W);
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
    // Orphans land in the row above Root (y = -LEVEL_H), starting at Root.x.
    expect(positions.get('o1')).toEqual({ x: 0, y: -LEVEL_H });
    expect(positions.get('o2')).toEqual({ x: SLOT_W, y: -LEVEL_H });
  });

  it("anchors layout to Root's existing position so it does not jump on re-layout", () => {
    // Root placed at non-origin world coordinates by the user.
    const root = { ...makeNode('r', 'Root'), position: { x: 300, y: 100 } };
    const tree = makeTree(
      'r',
      [root, makeNode('a'), makeNode('b'), makeNode('orphan')],
      [makeConn('e1', 'r', 'a', 0), makeConn('e2', 'r', 'b', 1)],
    );
    const positions = computeTreeLayout(tree, OPTS);
    // Root must land exactly where the user had it.
    expect(positions.get('r')).toEqual({ x: 300, y: 100 });
    // Children go below Root, translated by (Rx, Ry).
    expect(positions.get('a')!.y).toBe(100 + LEVEL_H);
    expect(positions.get('b')!.y).toBe(100 + LEVEL_H);
    // Orphan in the row above Root, starting at Root.x.
    expect(positions.get('orphan')).toEqual({ x: 300, y: 100 - LEVEL_H });
  });
});
