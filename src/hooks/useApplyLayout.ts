import { useReactFlow } from '@xyflow/react';
import { GRID_SIZE, NODE_HEIGHT, NODE_WIDTH } from '../core/config/grid';
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
    // Feed xyflow's post-paint measured heights so wrapped multi-line labels
    // get extra row pitch. Unmeasured nodes fall back to NODE_HEIGHT inside
    // computeTreeLayout; a second Layout press picks up real measurements.
    const nodeHeights = new Map<string, number>();
    for (const n of getNodes()) {
      const h = n.measured?.height;
      if (h != null) nodeHeights.set(n.id, h);
    }
    const positions = computeTreeLayout(tree, { ...LAYOUT_OPTIONS, nodeHeights });
    useBTStore.getState().applyLayout(positions);
    // Defer one frame so xyflow re-measures node positions before fitView
    // reads them; otherwise it frames the pre-layout bounding box.
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 200 });
    });
  };
}
