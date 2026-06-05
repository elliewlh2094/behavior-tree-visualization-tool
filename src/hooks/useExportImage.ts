import { useCallback } from 'react';
import { getNodesBounds, useReactFlow } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useBTStore, type ExportMode } from '../store/bt-store';
import { captureTargetRef } from '../components/canvas/capture-target';

// Whitespace margin (flow units) around the tree's bounding box so nodes
// aren't flush against the image edge.
const EXPORT_PADDING = 24;

// Retina/print quality — the PNG is 2× the logical pixel size (AC1.12).
const PIXEL_RATIO = 2;

export interface ExportImageOptions {
  mode: ExportMode;
  filename: string;
}

// Reads the current theme's canvas background from the CSS custom property so
// themed exports match whatever the user is looking at (light/dark/custom).
function resolveCanvasBackground(): string | undefined {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--bt-canvas-bg')
    .trim();
  return value || undefined;
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Returns an async export function. It flips the transient `exportInProgress`
 * flag (which Canvas/BTNode read to hide overlays + the selection ring), waits
 * one animation frame so React commits those removals, then captures the
 * React Flow viewport at full-tree bounds via html-to-image. The flag always
 * clears in `finally`, so a capture failure still restores the editor UI
 * (AC1.14/AC1.15). Throws on a missing canvas or a toPng failure — the caller
 * (ExportImageModal) surfaces the message inline.
 */
export function useExportImage(): (opts: ExportImageOptions) => Promise<void> {
  const { getNodes } = useReactFlow();
  const setExportInProgress = useBTStore((s) => s.setExportInProgress);

  return useCallback(
    async ({ mode, filename }: ExportImageOptions) => {
      const root = captureTargetRef.current;
      const viewport = root?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewport) {
        throw new Error('Canvas is not ready');
      }

      setExportInProgress(mode);
      try {
        // Let React paint the overlay/ring removals before the snapshot.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );

        const bounds = getNodesBounds(getNodes());
        const width = Math.ceil(bounds.width + EXPORT_PADDING * 2);
        const height = Math.ceil(bounds.height + EXPORT_PADDING * 2);

        // The viewport is positioned in flow coordinates; translate so the
        // tree's top-left lands at (padding, padding) at scale 1, which frames
        // the whole tree regardless of the user's current pan/zoom (AC1.9).
        const themedBackground =
          mode === 'themed' ? resolveCanvasBackground() : undefined;
        const dataUrl = await toPng(viewport, {
          width,
          height,
          pixelRatio: PIXEL_RATIO,
          // Omit (not undefined) in transparent mode so html-to-image leaves
          // the alpha channel intact (AC1.7).
          ...(themedBackground ? { backgroundColor: themedBackground } : {}),
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${EXPORT_PADDING - bounds.x}px, ${EXPORT_PADDING - bounds.y}px) scale(1)`,
          },
        });

        triggerDownload(dataUrl, filename);
      } finally {
        setExportInProgress(null);
      }
    },
    [getNodes, setExportInProgress],
  );
}
