import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/canvas/Canvas';
import { NodePalette } from './components/node-palette/NodePalette';
import { PropertyPanel } from './components/property-panel/PropertyPanel';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { StartScreen } from './components/start-screen/StartScreen';
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <Toolbar onOpenSettings={() => setSettingsOpen(true)} />
        <div className="flex flex-1 overflow-hidden">
          <NodePalette />
          <main className="flex-1">
            <Canvas />
          </main>
          <PropertyPanel />
        </div>
        <ValidationPanel />
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ReactFlowProvider>
  );
}
