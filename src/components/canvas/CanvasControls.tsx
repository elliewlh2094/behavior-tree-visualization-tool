import {
  useReactFlow,
  useStore,
  useStoreApi,
  useViewport,
} from '@xyflow/react';
import { useBTStore } from '../../store/bt-store';

// 水平的畫布控制列（左下角），取代 xyflow 內建的垂直 <Controls> +
// <ZoomChip>。它以應用程式自己的 --bt-* 主題變數繪製（淺色與暗色都有
// 定義），所以在兩種模式下都能正確渲染。內建的 Controls 依賴 xyflow 的
// 預設 CSS，在淺色模式下看不見。
// 順序：適應視圖 · 放大 · 縮小 · 縮放百分比（重設）· 鎖定 · 搜尋。

// 圖示與工具列採用相同的繪製風格：16 單位的 viewBox、以 14×14 渲染、
// currentColor 線條寬度 1.5、圓角線端。
const svgProps = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  width: 14,
  height: 14,
  'aria-hidden': true,
} as const;

function FitIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 6V4.5A1.5 1.5 0 0 1 4.5 3H6" />
      <path d="M10 3h1.5A1.5 1.5 0 0 1 13 4.5V6" />
      <path d="M13 10v1.5a1.5 1.5 0 0 1-1.5 1.5H10" />
      <path d="M6 13H4.5A1.5 1.5 0 0 1 3 11.5V10" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg {...svgProps}>
      <path d="M8 3.5v9" />
      <path d="M3.5 8h9" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3.5 8h9" />
    </svg>
  );
}

function LockedIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.75" y="7" width="8.5" height="6" rx="1.3" />
      <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}

function UnlockedIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.75" y="7" width="8.5" height="6" rx="1.3" />
      <path d="M5.5 7V5.25a2.5 2.5 0 0 1 4.8-0.9" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="6.75" cy="6.75" r="3.5" />
      <path d="M9.5 9.5 13 13" />
    </svg>
  );
}

// 共用的按鈕外形。按鈕在控制列的面板背景上是透明的；hover 時淺色模式
// 變為白色、暗色模式變為 slate-700，與 Toolbar 的慣用寫法一致。
// 停用狀態降低飽和度，但不改變版面。
const btnBase =
  'flex h-7 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 enabled:hover:bg-white dark:enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40';
const iconBtn = `${btnBase} w-7`;

function Divider() {
  return (
    <div
      className="mx-0.5 h-5 w-px"
      style={{ backgroundColor: 'var(--bt-border)' }}
      aria-hidden
    />
  );
}

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const percent = Math.round(zoom * 100);

  // 比照 xyflow 內建的 Controls：在縮放極限時停用放大／縮小，
  // 並從鎖定按鈕所切換的同一組互動旗標推導鎖定狀態。
  const minZoomReached = useStore((s) => s.transform[2] <= s.minZoom);
  const maxZoomReached = useStore((s) => s.transform[2] >= s.maxZoom);
  const isInteractive = useStore(
    (s) => s.nodesDraggable || s.nodesConnectable || s.elementsSelectable,
  );
  const store = useStoreApi();
  const setSearchOpen = useBTStore((s) => s.setSearchOpen);

  const toggleInteractivity = () =>
    store.setState({
      nodesDraggable: !isInteractive,
      nodesConnectable: !isInteractive,
      elementsSelectable: !isInteractive,
    });

  return (
    <div
      role="toolbar"
      aria-label="Canvas controls"
      className="flex items-center gap-0.5 rounded-lg border p-1 shadow-md"
      style={{
        backgroundColor: 'var(--bt-panel-bg)',
        borderColor: 'var(--bt-border)',
        color: 'var(--bt-text-primary)',
      }}
    >
      <button
        type="button"
        onClick={() => fitView({ padding: 0.2, duration: 200 })}
        className={iconBtn}
        title="Fit view"
        aria-label="Fit view"
      >
        <FitIcon />
      </button>
      <button
        type="button"
        onClick={() => zoomIn({ duration: 200 })}
        disabled={maxZoomReached}
        className={iconBtn}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <PlusIcon />
      </button>
      <button
        type="button"
        onClick={() => zoomOut({ duration: 200 })}
        disabled={minZoomReached}
        className={iconBtn}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <MinusIcon />
      </button>
      <button
        type="button"
        onClick={() => setViewport({ x, y, zoom: 1 }, { duration: 200 })}
        // 固定寬度（可容納 "1000%"）加上 tabular-nums，
        // 讓控制列的寬度不會隨著位數改變。
        className={`${btnBase} w-12 px-1 text-[11px] font-medium tabular-nums`}
        title="Reset zoom to 100%"
        aria-label={`Zoom: ${percent} percent. Click to reset to 100%`}
      >
        {percent}%
      </button>
      <Divider />
      <button
        type="button"
        onClick={toggleInteractivity}
        aria-pressed={!isInteractive}
        className={iconBtn}
        title={isInteractive ? 'Lock canvas interactions' : 'Unlock canvas interactions'}
        aria-label={isInteractive ? 'Lock canvas interactions' : 'Unlock canvas interactions'}
      >
        {isInteractive ? <UnlockedIcon /> : <LockedIcon />}
      </button>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className={iconBtn}
        title="Search nodes (Ctrl+F)"
        aria-label="Search nodes"
      >
        <SearchIcon />
      </button>
    </div>
  );
}
