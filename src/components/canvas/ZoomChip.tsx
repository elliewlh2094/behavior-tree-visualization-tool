import { ControlButton, useReactFlow, useViewport } from '@xyflow/react';

// Rendered as a child of <Controls> so it sits directly below the native
// zoom/fit/lock buttons in the bottom-left cluster. Uses ControlButton (not a
// standalone pill) to inherit the cluster's border, hover, and sizing.
export function ZoomChip() {
  const { x, y, zoom } = useViewport();
  const { setViewport } = useReactFlow();
  const percent = Math.round(zoom * 100);
  return (
    <ControlButton
      onClick={() => setViewport({ x, y, zoom: 1 }, { duration: 200 })}
      title="Reset zoom to 100%"
      aria-label={`Zoom: ${percent} percent. Click to reset to 100%`}
      className="!w-auto !min-w-[1.625rem] px-1.5 text-[11px] font-medium leading-none"
    >
      {percent}%
    </ControlButton>
  );
}
