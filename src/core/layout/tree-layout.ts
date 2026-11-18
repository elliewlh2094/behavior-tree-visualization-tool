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
  /**
   * 選用：每個節點左緣到中心線（Handle 所在的垂直線）的水平距離。
   * 父節點依子節點中心線的平均值置中，所以不同寬度的節點也能對齊。
   * 未提供的節點使用 `nodeWidth / 2`；完全不提供時，結果與 v1.12 之前
   * 「等寬節點、左上角平均」的排版相同。
   */
  nodeAnchors?: Map<string, number>;
  /**
   * v1.13（AD12）：`'compact'` 改用子樹輪廓壓縮定位兄弟子樹，深的子樹可以伸到
   * 淺的兄弟子樹下方。省略或 `'default'` 時使用原本「每個葉節點一欄」的排版。
   */
  mode?: 'default' | 'compact';
  /** 選用：每個節點的寬度，只有 compact 模式使用。未提供的節點使用 `nodeWidth`。 */
  nodeWidths?: Map<string, number>;
}

// 子樹輪廓：索引是相對深度，值是該列的 [左緣, 右緣]，以子樹根節點的中心線為 0。
type Contour = Array<[number, number]>;

function mergeContour(acc: Contour, c: Contour, offset: number): void {
  c.forEach(([l, r], d) => {
    const cur = acc[d];
    acc[d] = cur
      ? [Math.min(cur[0], l + offset), Math.max(cur[1], r + offset)]
      : [l + offset, r + offset];
  });
}

// 由左向右逐一放置兄弟子樹：每個子樹盡量向左，只與已放置子樹共同存在的列比較，
// 保持至少 `gap` 的間距。回傳每個子樹根節點中心線的偏移。
function packLeftToRight(contours: Contour[], gap: number): number[] {
  const acc: Contour = [];
  return contours.map((c) => {
    let offset = acc.length === 0 ? 0 : -Infinity;
    for (let d = 0; d < Math.min(acc.length, c.length); d += 1) {
      offset = Math.max(offset, acc[d]![1] + gap - c[d]![0]);
    }
    mergeContour(acc, c, offset);
    return offset;
  });
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
  const { gridSize, nodeWidth, nodeHeight, gapX, gapY, nodeHeights, nodeAnchors, nodeWidths } =
    options;
  const relative = new Map<string, { x: number; y: number }>();
  const slotWidth = nodeWidth + gapX;
  const levelHeight = nodeHeight + gapY;
  const heightOf = (id: string): number => nodeHeights?.get(id) ?? nodeHeight;
  const anchorOf = (id: string): number => nodeAnchors?.get(id) ?? nodeWidth / 2;

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

  if (options.mode === 'compact') {
    const widthOf = (id: string): number => nodeWidths?.get(id) ?? nodeWidth;
    // 子節點中心線相對於父節點中心線的偏移。
    const offsets = new Map<string, number>();
    const mirror = (c: Contour): Contour => c.map(([l, r]) => [-r, -l]);
    const place = (id: string): Contour => {
      const kids = childIndex.get(id) ?? [];
      const own: [number, number] = [-anchorOf(id), widthOf(id) - anchorOf(id)];
      if (kids.length === 0) return [own];
      const contours = kids.map(place);
      // 由左向右與由右向左（鏡像後由左向右）各放置一次，對齊第一個子樹後取平均。
      // 兩組都是滿足所有「x_j − x_i ≥ d_ij」限制的解，平均值仍滿足，所以不重疊；
      // 夾在大子樹之間的小子樹因此位於中間，而不是擠向左側。
      const fromLeft = packLeftToRight(contours, gapX);
      const fromRight = packLeftToRight([...contours].reverse().map(mirror), gapX)
        .reverse()
        .map((o) => -o);
      const offs = fromLeft.map((o, i) => (o + fromRight[i]! - fromRight[0]!) / 2);
      const mid = (offs[0]! + offs[offs.length - 1]!) / 2;
      // 父節點中心線位於首末子節點中心線的中點；子樹輪廓從下一列開始。
      const below: Contour = [];
      kids.forEach((k, i) => {
        const o = offs[i]! - mid;
        offsets.set(k, o);
        mergeContour(below, contours[i]!, o);
      });
      return [own, ...below];
    };
    place(tree.rootId);
    const assign = (id: string, center: number, depth: number): void => {
      relative.set(id, { x: center - anchorOf(id), y: rowY.get(depth) ?? depth * levelHeight });
      for (const k of childIndex.get(id) ?? []) assign(k, center + offsets.get(k)!, depth + 1);
    };
    assign(tree.rootId, 0, 0);
  } else {
    let nextLeafSlot = 0;
    const layoutSubtree = (id: string, depth: number): void => {
      const kids = childIndex.get(id) ?? [];
      const y = rowY.get(depth) ?? depth * levelHeight;
      if (kids.length === 0) {
        // 中心線位於槽位中央（槽位的節點部分寬 nodeWidth）。
        const center = nextLeafSlot * slotWidth + nodeWidth / 2;
        relative.set(id, { x: center - anchorOf(id), y });
        nextLeafSlot += 1;
        return;
      }
      for (const k of kids) layoutSubtree(k, depth + 1);
      const centerOf = (k: string): number => relative.get(k)!.x + anchorOf(k);
      const center = (centerOf(kids[0]!) + centerOf(kids[kids.length - 1]!)) / 2;
      relative.set(id, { x: center - anchorOf(id), y });
    };
    layoutSubtree(tree.rootId, 0);
  }

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
