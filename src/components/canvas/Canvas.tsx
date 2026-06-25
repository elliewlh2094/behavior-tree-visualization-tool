import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { selectActiveTree, useBTStore } from '../../store/bt-store';
import { usePreferencesStore } from '../../store/preferences-store';
import { useResolvedTheme } from '../../hooks/useResolvedTheme';
import { BTNode, type BTNodeData } from './BTNode';
import { SearchBox } from './SearchBox';
import { ZoomChip } from './ZoomChip';
import { captureTargetRef } from './capture-target';
import { resolveNodeColor } from './color-families';
import { NODE_KINDS, type NodeKind } from '../../core/model/node';
import { GRID_SIZE, NODE_WIDTH, NODE_HEIGHT, snapToGrid } from '../../core/config/grid';
import { PALETTE_DATA_TYPE } from '../node-palette/NodePalette';

const nodeTypes: NodeTypes = { bt: BTNode };
const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE];
const DELETE_KEYS = ['Backspace', 'Delete'];

// Selected edges get a contrast "outline" via 4 stacked zero-blur drop-shadows
// at cardinal offsets — SVG has no native path outline, and this approximates
// one without a custom edge component.
//
// Default edge color/thickness flow through CSS custom properties (recolored
// by .dark overrides in dark mode); selected styling is hardcoded *per
// theme* so the selection state stays visually unambiguous regardless of
// the user's resting edge preferences. The values are computed at render
// time below to keep them in sync with useResolvedTheme.
const EDGE_STYLE_DEFAULT = {
  stroke: 'var(--bt-edge-color)',
  strokeWidth: 'var(--bt-edge-thickness)',
};

interface ThemeColors {
  gridLineColor: string;
  axisColor: string;
  originColor: string;
  edgeSelectedStroke: string;
  edgeSelectedOutline: string;
  minimapBg: string;
  minimapMask: string;
}

function themeColorsFor(theme: 'light' | 'dark'): ThemeColors {
  if (theme === 'dark') {
    return {
      gridLineColor: '#1e293b',       // slate-800 — subtle against canvas slate-900
      axisColor: '#475569',           // slate-600 — visible crosshair
      originColor: '#64748b',         // slate-500 — small origin marker
      edgeSelectedStroke: '#f1f5f9',  // slate-100 — bright path
      edgeSelectedOutline: '#334155', // slate-700 — dark glow around the bright path
      minimapBg: '#0f172a',                  // slate-900 — matches the dark canvas
      minimapMask: 'rgba(148, 163, 184, 0.18)', // slate-400 wash over the off-screen area
    };
  }
  return {
    gridLineColor: '#f1f5f9',         // slate-100
    axisColor: '#e2e8f0',             // slate-200
    originColor: '#cbd5e1',           // slate-300
    edgeSelectedStroke: '#0f172a',    // slate-900 — dark path
    edgeSelectedOutline: '#e2e8f0',   // slate-200 — light glow
    minimapBg: '#f8fafc',                 // slate-50 — matches the light canvas
    minimapMask: 'rgba(15, 23, 42, 0.12)', // slate-900 wash over the off-screen area
  };
}

function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

export function Canvas() {
  const tree = useBTStore(selectActiveTree);
  const selection = useBTStore((s) => s.selection);
  const addNode = useBTStore((s) => s.addNode);
  const moveNode = useBTStore((s) => s.moveNode);
  const connect = useBTStore((s) => s.connect);
  const setSelection = useBTStore((s) => s.setSelection);
  const clearSelection = useBTStore((s) => s.clearSelection);
  const deleteSelection = useBTStore((s) => s.deleteSelection);
  const beginGesture = useBTStore((s) => s.beginGesture);
  const reorderChildren = useBTStore((s) => s.reorderChildren);
  const showGrid = usePreferencesStore((s) => s.showGrid);
  const nodeFamilyByKind = usePreferencesStore((s) => s.nodeFamilyByKind);
  // v1.9 image export: when set, hide editor-only overlays so they don't
  // bleed into the captured PNG. Transparent mode additionally drops the
  // xyflow <Background>; themed mode keeps it.
  const exportInProgress = useBTStore((s) => s.exportInProgress);
  const isExporting = exportInProgress !== null;
  // FR6 search: drive per-node amber highlights from the store. SearchBox
  // writes these; BTNode reads them out of node.data.
  const searchMatchIds = useBTStore((s) => s.searchMatchIds);
  const searchCurrentId = useBTStore((s) => s.searchCurrentId);
  // React Flow's <Background> and AxisOverlay/OriginCross write SVG attributes
  // (stroke, etc), where `var(--…)` does not resolve. Read the resolved theme
  // and pick concrete hex values that mirror the .dark cascade for the
  // class-driven surfaces.
  const resolvedTheme = useResolvedTheme();
  const themeColors = themeColorsFor(resolvedTheme);
  const edgeSelectedStyle = useMemo(
    () => ({
      stroke: themeColors.edgeSelectedStroke,
      strokeWidth: 2.5,
      filter: `drop-shadow(1.5px 0 0 ${themeColors.edgeSelectedOutline}) drop-shadow(-1.5px 0 0 ${themeColors.edgeSelectedOutline}) drop-shadow(0 1.5px 0 ${themeColors.edgeSelectedOutline}) drop-shadow(0 -1.5px 0 ${themeColors.edgeSelectedOutline})`,
    }),
    [themeColors.edgeSelectedStroke, themeColors.edgeSelectedOutline],
  );
  // Minimap node fills mirror each kind's user-chosen color family. The
  // `border` role (light-300 / dark-500) reads better than the pale `bg`
  // role at minimap scale while staying recognizably the same hue.
  const minimapNodeColor = useCallback(
    (node: Node<BTNodeData>) =>
      resolveNodeColor(nodeFamilyByKind[node.data.kind], 'border', resolvedTheme),
    [nodeFamilyByKind, resolvedTheme],
  );

  const { screenToFlowPosition, setViewport: setRfViewport, fitView } = useReactFlow();
  const activeTreeId = useBTStore((s) => s.activeTreeId);
  const storedViewport = useBTStore((s) => s.viewportByTreeId[s.activeTreeId]);
  const setStoreViewport = useBTStore((s) => s.setViewport);

  // Restore the target tab's viewport on every activeTreeId change. Skips
  // the initial mount (xyflow's `fitView` prop handles first-load framing).
  // For tabs without a stored viewport (never-visited tabs, mid-session
  // file opens that reset viewportByTreeId), call fitView so the tree
  // gets framed sensibly instead of snapping to origin / zoom 1.
  const prevTreeIdRef = useRef(activeTreeId);
  useEffect(() => {
    if (prevTreeIdRef.current === activeTreeId) return;
    prevTreeIdRef.current = activeTreeId;
    if (storedViewport) {
      setRfViewport(storedViewport);
    } else {
      fitView();
    }
  }, [activeTreeId, storedViewport, setRfViewport, fitView]);

  const onMoveEnd = useCallback(
    (_: unknown, viewport: Viewport) => setStoreViewport(activeTreeId, viewport),
    [activeTreeId, setStoreViewport],
  );

  const nodes = useMemo<Node<BTNodeData>[]>(
    () =>
      tree.nodes.map((n) => ({
        id: n.id,
        type: 'bt',
        position: n.position,
        // Seed the node's size so the minimap / getNodesBounds have dimensions
        // even before (or without) a ResizeObserver measurement. In controlled
        // mode our derived `nodes` array is rebuilt on every selection/search
        // change without a `measured` field, which otherwise leaves the minimap
        // blank. `initialWidth/Height` are a hint only — real measurement still
        // wins for handle/edge anchoring, so two-line nodes stay correct.
        initialWidth: NODE_WIDTH,
        initialHeight: NODE_HEIGHT,
        data: {
          kind: n.kind,
          name: n.name,
          isSearchMatch: searchMatchIds.has(n.id),
          isCurrentMatch: n.id === searchCurrentId,
        },
        selected: selection.nodeIds.has(n.id),
      })),
    [tree.nodes, selection, searchMatchIds, searchCurrentId],
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
          style: isSelected ? edgeSelectedStyle : EDGE_STYLE_DEFAULT,
        };
      }),
    [tree.connections, selection, edgeSelectedStyle],
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
      const current = selectActiveTree(useBTStore.getState());
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
      className="relative h-full w-full"
      style={{ backgroundColor: 'var(--bt-canvas-bg)' }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {!isExporting &&
        (showGrid ? (
          <AxisOverlay color={themeColors.axisColor} />
        ) : (
          <OriginCross color={themeColors.originColor} />
        ))}
      {!isExporting && <SearchBox />}
      <ReactFlow
        ref={captureTargetRef}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={beginGesture}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={onMoveEnd}
        onBeforeDelete={onBeforeDelete}
        onPaneClick={onPaneClick}
        deleteKeyCode={DELETE_KEYS}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        snapToGrid
        snapGrid={SNAP_GRID}
        fitView
        style={{ background: 'transparent' }}
      >
        {showGrid && exportInProgress !== 'transparent' && (
          <Background
            variant={BackgroundVariant.Lines}
            gap={GRID_SIZE}
            color={themeColors.gridLineColor}
          />
        )}
        <Controls>
          <ZoomChip />
        </Controls>
        {!isExporting && (
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={3}
            bgColor={themeColors.minimapBg}
            maskColor={themeColors.minimapMask}
            pannable
            zoomable
            ariaLabel="Tree minimap"
          />
        )}
      </ReactFlow>
    </div>
  );
}

// Both overlays render in screen space so their stroke width stays constant
// at every zoom level. World (0, 0) projects to screen (viewport.x, viewport.y)
// under React Flow's `translate(x, y) scale(zoom)` transform.

// Full-screen X/Y axes through world (0, 0). Shown together with the grid so
// the origin remains obvious at any pan/zoom. Color comes from Canvas so it
// can shift with the resolved theme.
function AxisOverlay({ color }: { color: string }) {
  const { x, y } = useViewport();
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <line x1="0" y1={y} x2="100%" y2={y} stroke={color} strokeWidth={2} />
      <line x1={x} y1="0" x2={x} y2="100%" stroke={color} strokeWidth={2} />
    </svg>
  );
}

// Small cross marker at world (0, 0). Shown when the grid is hidden so the
// origin stays locatable without the heavier axis crosshair.
const ORIGIN_CROSS_ARM = 25;
function OriginCross({ color }: { color: string }) {
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
        stroke={color}
        strokeWidth={1.5}
      />
      <line
        x1={x}
        y1={y - ORIGIN_CROSS_ARM}
        x2={x}
        y2={y + ORIGIN_CROSS_ARM}
        stroke={color}
        strokeWidth={1.5}
      />
    </svg>
  );
}

