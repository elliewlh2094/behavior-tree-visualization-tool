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

  describe('per-node heights (v1.8 FB5)', () => {
    it('pushes the child row down by the extra height when Root is taller (AC7.6)', () => {
      const tree = makeTree(
        'r',
        [makeNode('r', 'Root'), makeNode('a'), makeNode('b')],
        [makeConn('e1', 'r', 'a', 0), makeConn('e2', 'r', 'b', 1)],
      );
      const positions = computeTreeLayout(tree, {
        ...OPTS,
        nodeHeights: new Map([['r', 100]]),
      });
      // Root row pitch = rootHeight(100) + gapY(50) = 150 (vs default LEVEL_H 125).
      expect(positions.get('a')!.y).toBe(150);
      expect(positions.get('b')!.y).toBe(150);
      // Root still anchored at its user position.
      expect(positions.get('r')).toEqual({ x: 0, y: 0 });
    });

    it('accumulates per-row pitch down a deep chain (AC7.6)', () => {
      // r → a → a1; only 'a' (depth 1) is one grid row taller.
      const tree = makeTree(
        'r',
        [makeNode('r', 'Root'), makeNode('a'), makeNode('a1')],
        [makeConn('e1', 'r', 'a', 0), makeConn('e2', 'a', 'a1', 0)],
      );
      const positions = computeTreeLayout(tree, {
        ...OPTS,
        nodeHeights: new Map([['a', 100]]),
      });
      // depth 1 uses Root's default-height row: rowY[1] = 75 + 50 = 125.
      expect(positions.get('a')!.y).toBe(125);
      // depth 2 picks up 'a's extra height: rowY[2] = 125 + (100 + 50) = 275.
      expect(positions.get('a1')!.y).toBe(275);
    });

    it('grows the orphan row pitch above Root for a tall orphan (AC7.6)', () => {
      const tree = makeTree('r', [makeNode('r', 'Root'), makeNode('o1')], []);
      const positions = computeTreeLayout(tree, {
        ...OPTS,
        nodeHeights: new Map([['o1', 100]]),
      });
      // Orphan row pitch = tallest orphan(100) + gapY(50) = 150 above Root.
      expect(positions.get('o1')).toEqual({ x: 0, y: -150 });
    });

    it('an all-default-height map is byte-identical to omitting the map', () => {
      const tree = makeTree(
        'r',
        [makeNode('r', 'Root'), makeNode('a'), makeNode('b'), makeNode('orphan')],
        [makeConn('e1', 'r', 'a', 0), makeConn('e2', 'r', 'b', 1)],
      );
      const allDefault = new Map(
        tree.nodes.map((n) => [n.id, OPTS.nodeHeight] as const),
      );
      const withMap = computeTreeLayout(tree, { ...OPTS, nodeHeights: allDefault });
      const without = computeTreeLayout(tree, OPTS);
      expect([...withMap.entries()]).toEqual([...without.entries()]);
    });
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

  describe('per-node anchors (v1.12 AD11)', () => {
    it('centers a 50px control node over two 150px children by their centerlines', () => {
      // Root → Sequence → [a, b]. Sequence is 50px wide (anchor 25); the
      // others are 150px (anchor 75, the default nodeWidth / 2).
      const tree = makeTree(
        'r',
        [makeNode('r', 'Root'), makeNode('s', 'Sequence'), makeNode('a'), makeNode('b')],
        [
          makeConn('e1', 'r', 's', 0),
          makeConn('e2', 's', 'a', 0),
          makeConn('e3', 's', 'b', 1),
        ],
      );
      const positions = computeTreeLayout(tree, {
        ...OPTS,
        nodeAnchors: new Map([['s', 25]]),
      });
      const a = positions.get('a')!;
      const b = positions.get('b')!;
      const s = positions.get('s')!;
      const r = positions.get('r')!;
      // Sequence centerline (x + 25) sits midway between the child centerlines.
      expect(s.x + 25).toBe((a.x + 75 + b.x + 75) / 2);
      // Root (150px) centerline sits on the Sequence centerline.
      expect(r.x + 75).toBe(s.x + 25);
    });
  });

  describe('compact mode (v1.13 AD12)', () => {
    // Sequence 是 50 px 寬的符號方框（錨點 25）；其他節點 150 px（錨點 75）。
    const COMPACT: LayoutOptions = { ...OPTS, gapX: 25, mode: 'compact' };
    const widthOf = (tree: BehaviorTree, id: string): number =>
      tree.nodes.find((n) => n.id === id)!.kind === 'Sequence' ? 50 : 150;
    const sizes = (tree: BehaviorTree) => {
      const seqIds = tree.nodes.filter((n) => n.kind === 'Sequence').map((n) => n.id);
      return {
        nodeWidths: new Map(seqIds.map((id) => [id, 50] as [string, number])),
        nodeAnchors: new Map(seqIds.map((id) => [id, 25] as [string, number])),
      };
    };
    const spanOf = (tree: BehaviorTree, positions: Map<string, { x: number; y: number }>) => {
      const xs = [...positions].map(([id, p]) => [p.x, p.x + widthOf(tree, id)]).flat();
      return Math.max(...xs) - Math.min(...xs);
    };
    const center = (tree: BehaviorTree, positions: Map<string, { x: number; y: number }>, id: string) =>
      positions.get(id)!.x + widthOf(tree, id) / 2;

    // Root → s → [leaf1, deep, leaf2]，deep 是 Sequence，底下有 3 個葉節點。
    const deepTree = makeTree(
      'r',
      [
        makeNode('r', 'Root'),
        makeNode('s', 'Sequence'),
        makeNode('leaf1'),
        makeNode('deep', 'Sequence'),
        makeNode('leaf2'),
        makeNode('d1'),
        makeNode('d2'),
        makeNode('d3'),
      ],
      [
        makeConn('e1', 'r', 's', 0),
        makeConn('e2', 's', 'leaf1', 0),
        makeConn('e3', 's', 'deep', 1),
        makeConn('e4', 's', 'leaf2', 2),
        makeConn('e5', 'deep', 'd1', 0),
        makeConn('e6', 'deep', 'd2', 1),
        makeConn('e7', 'deep', 'd3', 2),
      ],
    );

    it('lets a deep subtree extend under its shallow siblings, so the tree is narrower', () => {
      const compact = computeTreeLayout(deepTree, { ...COMPACT, ...sizes(deepTree) });
      const standard = computeTreeLayout(deepTree, { ...OPTS, ...sizes(deepTree) });
      // deep 的子節點列（3 × 150 + 2 × 25 = 500 px）決定寬度；
      // leaf1／leaf2 只與 deep 本身同列比較，所以伸到 d1／d3 的上方。
      expect(spanOf(deepTree, compact)).toBe(500);
      expect(spanOf(deepTree, compact)).toBeLessThan(spanOf(deepTree, standard));
      expect(hasOverlap(deepTree, compact)).toBe(false);
      const leaf1 = compact.get('leaf1')!;
      const d1 = compact.get('d1')!;
      expect(leaf1.x + 150).toBeGreaterThan(d1.x);
    });

    it('centers a small subtree between two large siblings (mirror symmetry)', () => {
      // Root → s → [big1, mid, big2]，big1／big2 各有 3 個葉節點。
      const tree = makeTree(
        'r',
        [
          makeNode('r', 'Root'),
          makeNode('s', 'Sequence'),
          makeNode('big1', 'Sequence'),
          makeNode('mid'),
          makeNode('big2', 'Sequence'),
          ...['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id) => makeNode(id)),
        ],
        [
          makeConn('e1', 'r', 's', 0),
          makeConn('e2', 's', 'big1', 0),
          makeConn('e3', 's', 'mid', 1),
          makeConn('e4', 's', 'big2', 2),
          makeConn('e5', 'big1', 'a1', 0),
          makeConn('e6', 'big1', 'a2', 1),
          makeConn('e7', 'big1', 'a3', 2),
          makeConn('e8', 'big2', 'b1', 0),
          makeConn('e9', 'big2', 'b2', 1),
          makeConn('e10', 'big2', 'b3', 2),
        ],
      );
      const positions = computeTreeLayout(tree, { ...COMPACT, ...sizes(tree) });
      const mid = center(tree, positions, 'mid');
      const midpoint = (center(tree, positions, 'big1') + center(tree, positions, 'big2')) / 2;
      expect(Math.abs(mid - midpoint)).toBeLessThanOrEqual(OPTS.gridSize / 2);
      expect(hasOverlap(tree, positions)).toBe(false);
    });

    it('keeps every row free of overlaps and every parent centered over its children', () => {
      const positions = computeTreeLayout(deepTree, { ...COMPACT, ...sizes(deepTree) });
      expect(hasOverlap(deepTree, positions)).toBe(false);
      for (const [parent, first, last] of [
        ['s', 'leaf1', 'leaf2'],
        ['deep', 'd1', 'd3'],
        ['r', 's', 's'],
      ] as const) {
        const mid = (center(deepTree, positions, first) + center(deepTree, positions, last)) / 2;
        expect(Math.abs(center(deepTree, positions, parent) - mid)).toBeLessThanOrEqual(
          OPTS.gridSize,
        );
      }
      // Root 仍固定在使用者放置的位置。
      expect(positions.get('r')).toEqual({ x: 0, y: 0 });
    });

    // 同一列（相同 y）任兩個節點的水平區間不重疊。
    function hasOverlap(
      tree: BehaviorTree,
      positions: Map<string, { x: number; y: number }>,
    ): boolean {
      const items = [...positions].map(([id, p]) => ({ y: p.y, l: p.x, r: p.x + widthOf(tree, id) }));
      return items.some((a, i) =>
        items.some((b, j) => i < j && a.y === b.y && a.l < b.r && b.l < a.r),
      );
    }
  });
});
