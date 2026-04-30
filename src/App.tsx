import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/canvas/Canvas';
import { NodePalette } from './components/node-palette/NodePalette';
import { Sidebar } from './components/sidebar/Sidebar';
import { StartScreen } from './components/start-screen/StartScreen';
import { TabBar } from './components/tab-bar/TabBar';
import { Toolbar } from './components/toolbar/Toolbar';
import { ValidationPanel } from './components/validation/ValidationPanel';
import { usePreferencesSync } from './hooks/usePreferencesSync';
import { useTheme } from './hooks/useTheme';

export function App() {
  // Mirror the preferences store onto :root for both StartScreen and editor
  // so customized colors apply before the first tree opens (and so persisted
  // values from T3 take effect on initial render).
  usePreferencesSync();
  useTheme();
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
