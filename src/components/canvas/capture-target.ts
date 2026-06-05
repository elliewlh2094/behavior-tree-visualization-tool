// Shared handle to the live Canvas root DOM node. Canvas sets this on mount
// and clears it on unmount (via a callback ref); useExportImage (v1.9) reads
// it to find the capture target. The app renders exactly one Canvas, and the
// export hook lives in the Toolbar subtree — a sibling of Canvas under the
// shared ReactFlowProvider — so a module-scoped ref is simpler than threading
// a context provider across that split.
export const captureTargetRef: { current: HTMLDivElement | null } = {
  current: null,
};
