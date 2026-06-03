import { useReactFlow, useViewport } from '@xyflow/react';

export function ZoomChip() {
  const { x, y, zoom } = useViewport();
  const { setViewport } = useReactFlow();
  const percent = Math.round(zoom * 100);
  return (
    <button
      type="button"
      onClick={() => setViewport({ x, y, zoom: 1 }, { duration: 200 })}
      aria-label={`Zoom: ${percent} percent. Click to reset to 100%`}
      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {percent}%
    </button>
  );
}
