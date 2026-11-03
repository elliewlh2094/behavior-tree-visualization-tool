import type { BTConnection, BTNode } from '../model/node';

// 結構型別：同時接受 `BehaviorTree` 與 `BTTreeDef`。
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
   * 選用：每個節點量測到的高度（來自 xyflow 的 `node.measured.height`）。
   * 提供時，每一列的垂直間距會增加，以容納該列最高的節點，
   * 讓換行的多行標籤不會與下一列重疊。未提供 → 每一列都使用
   * `nodeHeight`，完全重現 v1.8 之前的等間距排版。
   */
  nodeHeights?: Map<string, number>;
}

/**
 * 使用自製的遞迴由上而下階層排版，計算樹中每個節點的新位置：
 * 葉節點依兄弟 `order` 由左至右排開，內部節點置中於其子節點上方，
 * 孤立節點排成一列，放在 Root 的正上方（與 Root 同一個 x 欄位，
 * 向右延伸）。所有位置都貼齊 `gridSize`。不修改輸入的樹。
 *
 * Root 固定在它現有的 `position`，所以重新排版永遠不會把樹從使用者
 * 正在看的位置拉走。整個計算出的排版會平移，讓 Root 落在使用者
 * 最後放置它的位置。
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

  // 每一列的垂直偏移：每一列位於上一列下方一個列間距處，
  // 一列的間距是該列最高的節點 + gapY。沒有 nodeHeights 時，
  // 每一列的間距都是固定的 `levelHeight` → 與舊的 `depth * levelHeight` 相同。
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
