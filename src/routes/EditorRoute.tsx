import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from '../components/canvas/Canvas';
import { NodePalette } from '../components/node-palette/NodePalette';
import { Sidebar } from '../components/sidebar/Sidebar';
import { TabBar } from '../components/tab-bar/TabBar';
import { Toolbar } from '../components/toolbar/Toolbar';
import { ValidationPanel } from '../components/validation/ValidationPanel';

// The editor shell, served at #/editor. Entering from the landing "Go to
// Editor" CTA (or a direct load) drops straight onto the canvas: the store
// seeds an empty single-Root document, so no intermediate screen is needed.
// Opening an existing file is the Toolbar's "Open" action.
export function EditorRoute() {
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
