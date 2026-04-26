import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/canvas/Canvas';
import { NodePalette } from './components/node-palette/NodePalette';
import { PropertyPanel } from './components/property-panel/PropertyPanel';
import { StartScreen } from './components/start-screen/StartScreen';
import { Toolbar } from './components/toolbar/Toolbar';
import { ValidationPanel } from './components/validation/ValidationPanel';

export function App() {
  const [showStartScreen, setShowStartScreen] = useState(true);

  if (showStartScreen) {
    return (
      <StartScreen
        onNewTree={() => setShowStartScreen(false)}
        onFileOpened={() => setShowStartScreen(false)}
      />
    );
  }

  // ReactFlowProvider wraps the whole editor (not just Canvas) so that
  // useReactFlow() hooks in the toolbar — e.g., useApplyLayout's fitView()
  // call — can reach the React Flow instance.
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col">
        <Toolbar />
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />
          <main className="flex-1">
            <Canvas />
          </main>
          <PropertyPanel />
        </div>
        <ValidationPanel />
      </div>
    </ReactFlowProvider>
  );
}
