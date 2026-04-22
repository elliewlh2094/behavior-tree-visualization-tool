import { Canvas } from './components/canvas/Canvas';
import { NodePalette } from './components/node-palette/NodePalette';

export function App() {
  return (
    <div className="flex h-screen w-screen">
      <NodePalette />
      <main className="flex-1">
        <Canvas />
      </main>
    </div>
  );
}
