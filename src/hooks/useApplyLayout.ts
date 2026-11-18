import { useReactFlow } from '@xyflow/react';
import { CONTROL_NODE_SIZE, GRID_SIZE, NODE_HEIGHT, NODE_WIDTH } from '../core/config/grid';
import { SYMBOL_KINDS } from '../components/canvas/kind-visuals';
import { computeTreeLayout } from '../core/layout/tree-layout';
import { selectActiveTree, useBTStore } from '../store/bt-store';

const LAYOUT_OPTIONS = {
  gridSize: GRID_SIZE,
  nodeWidth: NODE_WIDTH,
  nodeHeight: NODE_HEIGHT,
  gapX: 50,
  gapY: 50,
};

export function useApplyLayout(): () => void {
  const { fitView, getNodes } = useReactFlow();
  return () => {
    const tree = selectActiveTree(useBTStore.getState());
    // 提供 xyflow 在繪製後量測到的高度，讓換行的多行標籤得到額外的列間距。
    // 尚未量測的節點在 computeTreeLayout 內改用 NODE_HEIGHT；
    // 第二次按下 Layout 時會取得實際的量測值。
    const nodeHeights = new Map<string, number>();
    for (const n of getNodes()) {
      const h = n.measured?.height;
      if (h != null) nodeHeights.set(n.id, h);
    }
    // 符號方框與 Decorator 菱形的中心線距左緣 CONTROL_NODE_SIZE / 2（AD11）；
    // 其他種類使用預設的 NODE_WIDTH / 2。錨點由種類決定，不需要量測值。
    const nodeAnchors = new Map<string, number>();
    for (const n of tree.nodes) {
      if (SYMBOL_KINDS.has(n.kind) || n.kind === 'Decorator') {
        nodeAnchors.set(n.id, CONTROL_NODE_SIZE / 2);
      }
    }
    const positions = computeTreeLayout(tree, { ...LAYOUT_OPTIONS, nodeHeights, nodeAnchors });
    useBTStore.getState().applyLayout(positions);
    // 延後一個影格，讓 xyflow 在 fitView 讀取節點位置之前重新量測；
    // 否則 fitView 會以排版前的外框取景。
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 200 });
    });
  };
}
