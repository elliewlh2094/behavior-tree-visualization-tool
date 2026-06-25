import {
  useReactFlow,
  useStore,
  useStoreApi,
  useViewport,
} from '@xyflow/react';
import { useBTStore } from '../../store/bt-store';

// Horizontal canvas control bar (bottom-left), replacing xyflow's built-in
// vertical <Controls> + <ZoomChip>. Drawn with the app's own --bt-* theme vars
// (defined for both light and dark) so it renders correctly in both modes —
// the built-in Controls relied on xyflow's default CSS and rendered invisibly
// in light mode. Order: fit · zoom in · zoom out · zoom% (reset) · lock · search.

// Icons share the toolbar drawing style: 16-unit viewBox, 14×14 rendered,
// currentColor stroke at 1.5, rounded ends.
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

// Shared button shape. Buttons are transparent over the bar's panel bg; hover
// lifts to white (light) / slate-700 (dark), matching the Toolbar idiom. The
// disabled state desaturates without changing layout.
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

  // Mirror xyflow's built-in Controls: disable zoom-in/out at the zoom limits,
  // and derive the lock state from the same interactivity flags it toggles.
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
        // Fixed width (fits up to "1000%") + tabular-nums so the bar doesn't
        // change width as the digit count changes.
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
