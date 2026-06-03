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
  const { fitView } = useReactFlow();
  return () => {
    const tree = selectActiveTree(useBTStore.getState());
    const positions = computeTreeLayout(tree, LAYOUT_OPTIONS);
    useBTStore.getState().applyLayout(positions);
    // Defer one frame so xyflow re-measures node positions before fitView
    // reads them; otherwise it frames the pre-layout bounding box.
    requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 200 });
    });
  };
}
