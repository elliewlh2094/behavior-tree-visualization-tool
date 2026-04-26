import type { BehaviorTree } from '../model/node';

export interface LayoutOptions {
  gridSize: number;
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  gapY: number;
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
  tree: BehaviorTree,
  options: LayoutOptions,
): Map<string, { x: number; y: number }> {
  const { gridSize, nodeWidth, nodeHeight, gapX, gapY } = options;
  const relative = new Map<string, { x: number; y: number }>();
  const slotWidth = nodeWidth + gapX;
  const levelHeight = nodeHeight + gapY;

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

  let nextLeafSlot = 0;
  const layoutSubtree = (id: string, depth: number): void => {
    const kids = childIndex.get(id) ?? [];
    const y = depth * levelHeight;
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
  orphans.forEach((n, i) => {
    relative.set(n.id, {
      x: rootRelative.x + i * slotWidth,
      y: rootRelative.y - levelHeight,
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
