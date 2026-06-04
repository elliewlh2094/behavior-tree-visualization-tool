import type { BTConnection, BTNode } from '../model/node';

// Structural shape — accepts both `BehaviorTree` and `BTTreeDef`.
type Treeish = {
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
};

export interface LayoutOptions {
  gridSize: number;
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
  /**
   * Optional per-node measured heights (from xyflow's `node.measured.height`).
   * When provided, each row's vertical pitch grows to fit its tallest node so
   * wrapped multi-line labels don't overlap the row below. Absent → every row
   * uses `nodeHeight`, reproducing the pre-v1.8 uniform-pitch layout exactly.
   */
  nodeHeights?: Map<string, number>;
}

/**
 * Compute new positions for every node in the tree using a custom recursive
 * top-down hierarchy layout — leaves are spread left-to-right by sibling
 * `order`, internal nodes are centered over their children, and orphaned
 * nodes are placed in a row directly above Root (same x column as Root,
 * extending to the right). All positions are snapped to `gridSize`. The
 * input tree is not mutated.
 *
 * Root is anchored to its existing `position` so re-layout never yanks the
 * tree away from where the user is looking. The whole computed layout is
 * translated so Root ends up where the user last placed it.
 */
export function computeTreeLayout(
  tree: Treeish,
  options: LayoutOptions,
): Map<string, { x: number; y: number }> {
  const { gridSize, nodeWidth, nodeHeight, gapX, gapY, nodeHeights } = options;
  const relative = new Map<string, { x: number; y: number }>();
  const slotWidth = nodeWidth + gapX;
  const levelHeight = nodeHeight + gapY;
  const heightOf = (id: string): number => nodeHeights?.get(id) ?? nodeHeight;

  const childIndex = new Map<string, string[]>();
  const sortedConns = [...tree.connections].sort((a, b) => a.order - b.order);
  for (const conn of sortedConns) {
    let arr = childIndex.get(conn.parentId);
    if (!arr) {
      arr = [];
      childIndex.set(conn.parentId, arr);
    }
    arr.push(conn.childId);
  }

  // Per-row vertical offsets: each row sits one row-pitch below the previous,
  // where a row's pitch is its tallest node + gapY. With no nodeHeights this
  // collapses to a constant `levelHeight` per row → identical to the old
  // `depth * levelHeight`.
  const rowMaxHeight = new Map<number, number>();
  const gatherDepth = (id: string, depth: number): void => {
    rowMaxHeight.set(depth, Math.max(rowMaxHeight.get(depth) ?? 0, heightOf(id)));
    for (const k of childIndex.get(id) ?? []) gatherDepth(k, depth + 1);
  };
  gatherDepth(tree.rootId, 0);
  const rowY = new Map<number, number>();
  const maxDepth = rowMaxHeight.size > 0 ? Math.max(...rowMaxHeight.keys()) : 0;
  let yAcc = 0;
  for (let depth = 0; depth <= maxDepth; depth += 1) {
    rowY.set(depth, yAcc);
    yAcc += (rowMaxHeight.get(depth) ?? nodeHeight) + gapY;
  }

  let nextLeafSlot = 0;
  const layoutSubtree = (id: string, depth: number): void => {
    const kids = childIndex.get(id) ?? [];
    const y = rowY.get(depth) ?? depth * levelHeight;
    if (kids.length === 0) {
      relative.set(id, { x: nextLeafSlot * slotWidth, y });
      nextLeafSlot += 1;
      return;
    }
    for (const k of kids) layoutSubtree(k, depth + 1);
    const firstX = relative.get(kids[0]!)!.x;
    const lastX = relative.get(kids[kids.length - 1]!)!.x;
    relative.set(id, { x: (firstX + lastX) / 2, y });
  };
  layoutSubtree(tree.rootId, 0);

  const rootRelative = relative.get(tree.rootId) ?? { x: 0, y: 0 };
  const hasParent = new Set(tree.connections.map((c) => c.childId));
  const orphans = tree.nodes.filter(
    (n) => n.id !== tree.rootId && !hasParent.has(n.id),
  );
  const orphanRowPitch =
    orphans.reduce((m, n) => Math.max(m, heightOf(n.id)), 0) + gapY;
  orphans.forEach((n, i) => {
    relative.set(n.id, {
      x: rootRelative.x + i * slotWidth,
      y: rootRelative.y - orphanRowPitch,
    });
  });

  const root = tree.nodes.find((n) => n.id === tree.rootId);
  const rootUserX = root ? root.position.x : 0;
  const rootUserY = root ? root.position.y : 0;
  const dx = rootUserX - rootRelative.x;
  const dy = rootUserY - rootRelative.y;
  const snap = (v: number): number => Math.round(v / gridSize) * gridSize;
  const result = new Map<string, { x: number; y: number }>();
  for (const [id, p] of relative) {
    result.set(id, { x: snap(p.x + dx), y: snap(p.y + dy) });
  }
  return result;
}
