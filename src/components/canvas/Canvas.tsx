import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Panel,
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
import { CanvasControls } from './CanvasControls';
import { captureTargetRef } from './capture-target';
import { NODE_KINDS, type NodeKind } from '../../core/model/node';
import { GRID_SIZE, snapToGrid } from '../../core/config/grid';
import { PALETTE_DATA_TYPE } from '../node-palette/NodePalette';

const nodeTypes: NodeTypes = { bt: BTNode };
const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE];
const DELETE_KEYS = ['Backspace', 'Delete'];

// 被選取的邊以 4 個堆疊、零模糊、朝四個正方向偏移的 drop-shadow
// 形成對比「外框」。SVG 沒有原生的路徑外框，這個做法不需要自訂邊元件
// 就能近似出外框效果。
//
// 預設的邊顏色／粗細透過 CSS 自訂屬性傳遞（暗色模式下由 .dark 覆寫重新
// 著色）；選取樣式則*依主題*寫死，讓選取狀態不受使用者靜止狀態的邊偏好
// 影響，始終清楚可辨。這些值在下方的渲染期間計算，以便與
// useResolvedTheme 保持同步。
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
}

function themeColorsFor(theme: 'light' | 'dark'): ThemeColors {
  if (theme === 'dark') {
    return {
      gridLineColor: '#1e293b',       // slate-800：在畫布的 slate-900 上不顯眼
      axisColor: '#475569',           // slate-600：清楚可見的十字軸線
      originColor: '#64748b',         // slate-500：小型原點標記
      edgeSelectedStroke: '#f1f5f9',  // slate-100：明亮的路徑
      edgeSelectedOutline: '#334155', // slate-700：明亮路徑周圍的深色光暈
    };
  }
  return {
    gridLineColor: '#f1f5f9',         // slate-100
    axisColor: '#e2e8f0',             // slate-200
    originColor: '#cbd5e1',           // slate-300
    edgeSelectedStroke: '#0f172a',    // slate-900：深色路徑
    edgeSelectedOutline: '#e2e8f0',   // slate-200：淺色光暈
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
  // v1.9 圖片匯出：設定時，隱藏只屬於編輯器的覆蓋層，避免它們出現在
  // 擷取的 PNG 中。透明模式另外移除 xyflow 的 <Background>；
  // 主題模式保留它。
  const exportInProgress = useBTStore((s) => s.exportInProgress);
  const isExporting = exportInProgress !== null;
  // FR6 搜尋：依 store 驅動每個節點的琥珀色醒目標示。SearchBox 寫入
  // 這些值；BTNode 從 node.data 讀取。
  const searchMatchIds = useBTStore((s) => s.searchMatchIds);
  const searchCurrentId = useBTStore((s) => s.searchCurrentId);
  // React Flow 的 <Background> 與 AxisOverlay／OriginCross 寫入 SVG 屬性
  // （stroke 等），而 SVG 屬性無法解析 `var(--…)`。因此讀取解析後的主題，
  // 並選擇具體的 hex 值，對應以 class 驅動的介面元素所使用的 .dark 層疊樣式。
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
  const { screenToFlowPosition, setViewport: setRfViewport, fitView } = useReactFlow();
  const activeTreeId = useBTStore((s) => s.activeTreeId);
  const storedViewport = useBTStore((s) => s.viewportByTreeId[s.activeTreeId]);
  const setStoreViewport = useBTStore((s) => s.setViewport);

  // 每次 activeTreeId 改變時，還原目標分頁的視口。略過初次掛載
  // （初次載入的取景由 xyflow 的 `fitView` prop 處理）。
  // 沒有已儲存視口的分頁（從未造訪的分頁，或在工作階段中開啟檔案而
  // 重設 viewportByTreeId 的分頁）會呼叫 fitView，讓樹得到合理的取景，
  // 而不是跳到原點並把縮放設為 1。
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

  // React Flow 在受控模式下，把每個節點／邊上的 `selected` 視為事實來源。
  // 點擊與框選以 `{type:'select'}` 差異的形式送到這裡，必須套用回我們的
  // 選取狀態；否則下一次渲染會以 `selected: false` 覆蓋 React Flow 內部的嘗試。
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
        // 自我迴圈與重複的邊會被默默忽略：純函式操作是事實來源。
        // UI 仍保持一致，因為邊是從 tree.connections 渲染，
        // 而不是從 React Flow 的內部狀態渲染。
      }
    },
    [connect],
  );

  // 在拖曳手勢結束時，依被拖曳節點的水平位置同步 `order`。
  // 這裡重新讀取 store，避免 React 18 的批次更新提供過期的樹。
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

  // 自行處理刪除，讓「節點 + 邊」的多重刪除只佔一個歷史步驟。
  // 回傳 false 會取消 React Flow 的內部移除，這沒有問題：我們的
  // nodes／edges 是從 `tree` 推導出來的，store 更新後，
  // 下一次渲染會重新推導，結果不含已移除的項目。
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
        {!isExporting && (
          <Panel position="bottom-left">
            <CanvasControls />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

// 兩個覆蓋層都在螢幕空間中渲染，所以線條寬度在任何縮放層級下都相同。
// 在 React Flow 的 `translate(x, y) scale(zoom)` 轉換下，
// 世界座標 (0, 0) 投影到螢幕座標 (viewport.x, viewport.y)。

// 通過世界座標 (0, 0) 的全螢幕 X／Y 軸。與格線一起顯示，讓原點在任何
// 平移／縮放下都很明顯。顏色由 Canvas 提供，以便隨解析後的主題改變。
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

// 世界座標 (0, 0) 上的小型十字標記。格線隱藏時顯示，讓使用者
// 不需要較顯眼的十字軸線也能找到原點。
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

