import { useReactFlow } from '@xyflow/react';
import { GRID_SIZE, NODE_HEIGHT, NODE_WIDTH } from '../core/config/grid';
import { computeTreeLayout } from '../core/layout/tree-layout';
import { useBTStore } from '../store/bt-store';

const LAYOUT_OPTIONS = {
  gridSize: GRID_SIZE,
  nodeWidth: NODE_WIDTH,
  nodeHeight: NODE_HEIGHT,
  gapX: 50,
  gapY: 50,
};

/**
 * Returns a stable handler that re-positions every node into a clean
 * top-down hierarchy and then re-centers the viewport on Root.
 *
 * Reads tree state via `getState()` instead of subscribing — the click
 * handler should run once with whatever the store holds at click time;
 * subscribing would cause re-renders on every tree mutation.
 *
 * Pans (not fits) — keeps the user's current zoom and centers on Root's
 * visual middle so the new layout opens at a known landmark instead of
 * the bounding-box centroid (which floats with tree shape and confuses
 * users who expect Root to be the anchor).
 */
export function useApplyLayout(): () => void {
  const { setCenter, getZoom } = useReactFlow();
  return () => {
    const tree = useBTStore.getState().tree;
    const root = tree.nodes.find((n) => n.id === tree.rootId);
    const positions = computeTreeLayout(tree, LAYOUT_OPTIONS);
    useBTStore.getState().applyLayout(positions);
    if (root) {
      // setCenter() ignores the current zoom unless we pass it back in
      // explicitly — its default is 1.0, not "preserve current."
      const zoom = getZoom();
      // Defer one frame so React has applied the new positions and
      // React Flow has re-measured before the camera moves.
      requestAnimationFrame(() => {
        setCenter(
          root.position.x + NODE_WIDTH / 2,
          root.position.y + NODE_HEIGHT / 2,
          { zoom, duration: 300 },
        );
      });
    }
  };
}
