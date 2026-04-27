import { useEffect } from 'react';
import { usePreferencesStore } from '../store/preferences-store';
import { KIND_VISUALS } from '../components/canvas/kind-visuals';
import type { NodeKind } from '../core/model/node';

// Mirrors the preferences store onto :root as CSS custom properties so any
// component that reads `var(--bt-*)` (in inline style) re-paints when the
// user changes a preference. Defaults in tailwind.css already match
// DEFAULT_PREFERENCES, so the first effect run after mount is a visual no-op.
export function usePreferencesSync(): void {
  const canvasBg = usePreferencesStore((s) => s.canvasBg);
  const gridLineColor = usePreferencesStore((s) => s.gridLineColor);
  const edgeColor = usePreferencesStore((s) => s.edgeColor);
  const edgeThickness = usePreferencesStore((s) => s.edgeThickness);
  const nodeBorderThickness = usePreferencesStore((s) => s.nodeBorderThickness);
  const nodeBgByKind = usePreferencesStore((s) => s.nodeBgByKind);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bt-canvas-bg', canvasBg);
    root.style.setProperty('--bt-grid-color', gridLineColor);
    root.style.setProperty('--bt-edge-color', edgeColor);
    root.style.setProperty('--bt-edge-thickness', `${edgeThickness}px`);
    root.style.setProperty('--bt-node-border-thickness', `${nodeBorderThickness}px`);
    for (const kind of Object.keys(nodeBgByKind) as NodeKind[]) {
      root.style.setProperty(KIND_VISUALS[kind].bgVar, nodeBgByKind[kind]);
    }
  }, [canvasBg, gridLineColor, edgeColor, edgeThickness, nodeBorderThickness, nodeBgByKind]);
}
