// Shared handle to the live React Flow root (`.react-flow` div). Canvas sets
// this via `<ReactFlow ref={captureTargetRef}>` and React clears it on
// unmount; useExportImage (v1.9) reads it to find the capture target. The app
// renders exactly one Canvas, and the export hook lives in the Toolbar
// subtree — a sibling of Canvas under the shared ReactFlowProvider — so a
// module-scoped ref is simpler than threading a context provider across that
// split.
export const captureTargetRef: { current: HTMLDivElement | null } = {
  current: null,
};
