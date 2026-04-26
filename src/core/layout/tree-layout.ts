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
 * nodes are placed in a single column to the right of the main tree. All
 * positions are snapped to `gridSize`. The input tree is not mutated.
 */
export function computeTreeLayout(
  tree: BehaviorTree,
  options: LayoutOptions,
): Map<string, { x: number; y: number }> {
  const { gridSize, nodeWidth, nodeHeight, gapX, gapY } = options;
  const positions = new Map<string, { x: number; y: number }>();
  const snap = (v: number): number => Math.round(v / gridSize) * gridSize;
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
    const y = snap(depth * levelHeight);
    if (kids.length === 0) {
      positions.set(id, { x: snap(nextLeafSlot * slotWidth), y });
      nextLeafSlot += 1;
      return;
    }
    for (const k of kids) layoutSubtree(k, depth + 1);
    const firstX = positions.get(kids[0]!)!.x;
    const lastX = positions.get(kids[kids.length - 1]!)!.x;
    positions.set(id, { x: snap((firstX + lastX) / 2), y });
  };
  layoutSubtree(tree.rootId, 0);

  const hasParent = new Set(tree.connections.map((c) => c.childId));
  const orphans = tree.nodes.filter(
    (n) => n.id !== tree.rootId && !hasParent.has(n.id),
  );
  if (orphans.length > 0) {
    let maxX = 0;
    for (const p of positions.values()) if (p.x > maxX) maxX = p.x;
    const orphanX = snap(maxX + slotWidth);
    orphans.forEach((n, i) => {
      positions.set(n.id, { x: orphanX, y: snap(i * levelHeight) });
    });
  }

  return positions;
}
