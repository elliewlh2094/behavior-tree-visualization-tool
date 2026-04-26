import { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useBTStore } from '../../store/bt-store';
import { BTNode, type BTNodeData } from './BTNode';
import { NODE_KINDS, type NodeKind } from '../../core/model/node';
import { GRID_SIZE, snapToGrid } from '../../core/config/grid';
import { PALETTE_DATA_TYPE } from '../node-palette/NodePalette';

const nodeTypes: NodeTypes = { bt: BTNode };
const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE];
const DELETE_KEYS = ['Backspace', 'Delete'];

// Selected edges get a slate-200 "outline" via 4 stacked zero-blur drop-shadows
// at cardinal offsets — SVG has no native path outline, and this approximates
// one without a custom edge component.
const EDGE_STYLE_DEFAULT = { stroke: '#64748b', strokeWidth: 1.5 };
const EDGE_STYLE_SELECTED = {
  stroke: '#0f172a',
  strokeWidth: 2.5,
  filter:
    'drop-shadow(1.5px 0 0 #e2e8f0) drop-shadow(-1.5px 0 0 #e2e8f0) drop-shadow(0 1.5px 0 #e2e8f0) drop-shadow(0 -1.5px 0 #e2e8f0)',
};

function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

export function Canvas() {
  const tree = useBTStore((s) => s.tree);
  const selection = useBTStore((s) => s.selection);
  const addNode = useBTStore((s) => s.addNode);
  const moveNode = useBTStore((s) => s.moveNode);
  const connect = useBTStore((s) => s.connect);
  const setSelection = useBTStore((s) => s.setSelection);
  const clearSelection = useBTStore((s) => s.clearSelection);
  const deleteSelection = useBTStore((s) => s.deleteSelection);
  const beginGesture = useBTStore((s) => s.beginGesture);
  const reorderChildren = useBTStore((s) => s.reorderChildren);
  const showGrid = useBTStore((s) => s.showGrid);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useMemo<Node<BTNodeData>[]>(
    () =>
      tree.nodes.map((n) => ({
        id: n.id,
        type: 'bt',
        position: n.position,
        data: { kind: n.kind, name: n.name },
        selected: selection.nodeIds.has(n.id),
      })),
    [tree.nodes, selection],
  );

  const edges = useMemo<Edge[]>(
    () =>
      tree.connections.map((c) => {
        const isSelected = selection.edgeIds.has(c.id);
        return {
          id: c.id,
          source: c.parentId,
          target: c.childId,
          selected: isSelected,
          style: isSelected ? EDGE_STYLE_SELECTED : EDGE_STYLE_DEFAULT,
        };
      }),
    [tree.connections, selection],
  );

  // React Flow in controlled mode treats `selected` on each node/edge as the
  // source of truth. Clicks and box-selects arrive here as `{type:'select'}`
  // deltas that must be applied back into our selection, otherwise the next
  // render writes `selected: false` over RF's internal attempt.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let nextNodeIds: Set<string> | null = null;
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, {
            x: snapToGrid(change.position.x),
            y: snapToGrid(change.position.y),
          });
        } else if (change.type === 'select') {
          if (!nextNodeIds) {
            nextNodeIds = new Set(useBTStore.getState().selection.nodeIds);
          }
          if (change.selected) nextNodeIds.add(change.id);
          else nextNodeIds.delete(change.id);
        }
      }
      if (nextNodeIds) {
        const current = useBTStore.getState().selection;
        setSelection({ nodeIds: nextNodeIds, edgeIds: current.edgeIds });
      }
    },
    [moveNode, setSelection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      let nextEdgeIds: Set<string> | null = null;
      for (const change of changes) {
        if (change.type === 'select') {
          if (!nextEdgeIds) {
            nextEdgeIds = new Set(useBTStore.getState().selection.edgeIds);
          }
          if (change.selected) nextEdgeIds.add(change.id);
          else nextEdgeIds.delete(change.id);
        }
      }
      if (nextEdgeIds) {
        const current = useBTStore.getState().selection;
        setSelection({ nodeIds: current.nodeIds, edgeIds: nextEdgeIds });
      }
    },
    [setSelection],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      try {
        connect(params.source, params.target);
      } catch {
        // Self-loops and duplicate edges are silently ignored — the pure op
        // is the source of truth; the UI stays consistent because edges
        // render from tree.connections, not React Flow's internal state.
      }
    },
    [connect],
  );

  // Sync `order` to the dragged node's horizontal position at gesture end.
  // Reads the store fresh so React 18 batching can't serve a stale tree.
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent | MouseEvent, dragged: Node) => {
      const current = useBTStore.getState().tree;
      const incoming = current.connections.find((c) => c.childId === dragged.id);
      if (!incoming) return;
      const parentId = incoming.parentId;
      const siblings = current.connections
        .filter((c) => c.parentId === parentId)
        .map((c) => {
          const child = current.nodes.find((n) => n.id === c.childId);
          return child
            ? { id: c.childId, x: child.position.x, currentOrder: c.order }
            : null;
        })
        .filter((s): s is { id: string; x: number; currentOrder: number } => s !== null);
      if (siblings.length < 2) return;
      siblings.sort((a, b) => a.x - b.x || a.currentOrder - b.currentOrder);
      reorderChildren(parentId, siblings.map((s) => s.id));
    },
    [reorderChildren],
  );

  // Handle delete ourselves so node+edge multi-delete is one history step.
  // Returning false cancels React Flow's internal pruning, which is fine
  // because our nodes/edges are derived from `tree` — once the store updates,
  // the next render re-derives without the removed items.
  const onBeforeDelete = useCallback(async () => {
    deleteSelection();
    return false;
  }, [deleteSelection]);

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData(PALETTE_DATA_TYPE);
      if (!raw || !isNodeKind(raw) || raw === 'Root') return;

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(raw, {
        x: snapToGrid(flowPosition.x),
        y: snapToGrid(flowPosition.y),
      });
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <div
      className="relative h-full w-full bg-white"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {showGrid ? <AxisOverlay /> : <OriginCross />}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={beginGesture}
        onNodeDragStop={onNodeDragStop}
        onBeforeDelete={onBeforeDelete}
        onPaneClick={onPaneClick}
        deleteKeyCode={DELETE_KEYS}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        snapToGrid
        snapGrid={SNAP_GRID}
        fitView
        style={{ background: 'transparent' }}
      >
        {showGrid && (
          <Background variant={BackgroundVariant.Lines} gap={GRID_SIZE} color="#f1f5f9" />
        )}
        <Controls />
      </ReactFlow>
    </div>
  );
}

// Both overlays render in screen space so their stroke width stays constant
// at every zoom level. World (0, 0) projects to screen (viewport.x, viewport.y)
// under React Flow's `translate(x, y) scale(zoom)` transform.

// Full-screen X/Y axes through world (0, 0). Shown together with the grid so
// the origin remains obvious at any pan/zoom.
function AxisOverlay() {
  const { x, y } = useViewport();
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <line x1="0" y1={y} x2="100%" y2={y} stroke="#e2e8f0" strokeWidth={2} />
      <line x1={x} y1="0" x2={x} y2="100%" stroke="#e2e8f0" strokeWidth={2} />
    </svg>
  );
}

// Small cross marker at world (0, 0). Shown when the grid is hidden so the
// origin stays locatable without the heavier axis crosshair.
const ORIGIN_CROSS_ARM = 25;
function OriginCross() {
  const { x, y } = useViewport();
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <line
        x1={x - ORIGIN_CROSS_ARM}
        y1={y}
        x2={x + ORIGIN_CROSS_ARM}
        y2={y}
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />
      <line
        x1={x}
        y1={y - ORIGIN_CROSS_ARM}
        x2={x}
        y2={y + ORIGIN_CROSS_ARM}
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />
    </svg>
  );
}

