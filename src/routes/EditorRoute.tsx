import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '../components/canvas/Canvas';
import { NodePalette } from '../components/node-palette/NodePalette';
import { Sidebar } from '../components/sidebar/Sidebar';
import { TabBar } from '../components/tab-bar/TabBar';
import { Toolbar } from '../components/toolbar/Toolbar';
import { ValidationPanel } from '../components/validation/ValidationPanel';
import { useBTStore } from '../store/bt-store';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import { useTheme } from '../hooks/useTheme';
import { usePreferencesSync } from '../hooks/usePreferencesSync';

// Restored when the editor unmounts (e.g. navigating back to the landing
// page) so the dirty `● ` / filename title doesn't leak onto other routes.
const BASE_TITLE = 'Behavior Tree Visualizer';

// The editor shell, served at #/editor. Entering from the landing "Go to
// Editor" CTA (or a direct load) drops straight onto the canvas: the store
// seeds an empty single-Root document, so no intermediate screen is needed.
// Opening an existing file is the Toolbar's "Open" action.
export function EditorRoute() {
  // Editor-only theming: honor the saved preference (Light/Dark/System) and
  // mirror the user's node color families onto :root. Owned here (not in App)
  // so the landing page can follow the OS theme independently.
  useTheme();
  usePreferencesSync();

  // FR9: reflect unsaved state in the tab. `dirty` is derived store-side, so
  // both the title and the beforeunload guard read the same source of truth.
  const dirty = useBTStore((s) => s.dirty);
  const fileName = useBTStore((s) => s.fileName);
  useBeforeUnload(dirty);
  useEffect(() => {
    document.title = dirty ? `● ${fileName}` : fileName;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [dirty, fileName]);

  // ReactFlowProvider wraps the whole editor (not just Canvas) so that
  // useReactFlow() hooks in the toolbar — e.g., useApplyLayout's fitView()
  // call — can reach the React Flow instance.
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />
          <main className="flex flex-1 flex-col overflow-hidden">
            <TabBar />
            <div className="flex-1 overflow-hidden">
              <Canvas />
            </div>
          </main>
          <Sidebar />
        </div>
        <ValidationPanel />
      </div>
    </ReactFlowProvider>
  );
}
