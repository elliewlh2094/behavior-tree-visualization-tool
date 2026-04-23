import { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
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

function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

function CanvasInner() {
  const tree = useBTStore((s) => s.tree);
  const selection = useBTStore((s) => s.selection);
  const addNode = useBTStore((s) => s.addNode);
  const moveNode = useBTStore((s) => s.moveNode);
  const connect = useBTStore((s) => s.connect);
  const removeNode = useBTStore((s) => s.removeNode);
  const disconnect = useBTStore((s) => s.disconnect);
  const setSelection = useBTStore((s) => s.setSelection);
  const clearSelection = useBTStore((s) => s.clearSelection);
  const { screenToFlowPosition } = useReactFlow();

  const nodes = useMemo<Node<BTNodeData>[]>(
    () =>
      tree.nodes.map((n) => ({
        id: n.id,
        type: 'bt',
        position: n.position,
        data: { kind: n.kind, name: n.name },
        selected: selection?.type === 'node' && selection.id === n.id,
      })),
    [tree.nodes, selection],
  );

  const edges = useMemo<Edge[]>(
    () =>
      tree.connections.map((c) => ({
        id: c.id,
        source: c.parentId,
        target: c.childId,
        selected: selection?.type === 'edge' && selection.id === c.id,
      })),
    [tree.connections, selection],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, {
            x: snapToGrid(change.position.x),
            y: snapToGrid(change.position.y),
          });
        } else if (change.type === 'select' && change.selected) {
          setSelection({ type: 'node', id: change.id });
        }
      }
    },
    [moveNode, setSelection],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'select' && change.selected) {
          setSelection({ type: 'edge', id: change.id });
        }
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

  const onBeforeDelete = useCallback(
    async ({ nodes: toDelete }: { nodes: Node[]; edges: Edge[] }) => {
      // Root is permanent — reject the whole transaction so React Flow does
      // not also prune Root's incident edges.
      if (toDelete.some((n) => n.id === tree.rootId)) return false;
      return true;
    },
    [tree.rootId],
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const n of deleted) removeNode(n.id);
    },
    [removeNode],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const e of deleted) disconnect(e.id);
    },
    [disconnect],
  );

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
      <AxisOverlay />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onBeforeDelete={onBeforeDelete}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onPaneClick={onPaneClick}
        deleteKeyCode={DELETE_KEYS}
        snapToGrid
        snapGrid={SNAP_GRID}
        fitView
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Lines} gap={GRID_SIZE} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// Renders the X and Y axes in screen space so their stroke width is constant
// at every zoom level. World (0, 0) projects to screen (viewport.x, viewport.y)
// under React Flow's `translate(x, y) scale(zoom)` transform.
function AxisOverlay() {
  const { x, y } = useViewport();
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <line x1="0" y1={y} x2="100%" y2={y} stroke="#475569" strokeWidth={2} />
      <line x1={x} y1="0" x2={x} y2="100%" stroke="#475569" strokeWidth={2} />
    </svg>
  );
}

export function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
