import { useFileOpen } from '../../hooks/useFileOpen';

export interface StartScreenProps {
  onNewTree: () => void;
  onFileOpened: () => void;
}

export function StartScreen({ onNewTree, onFileOpened }: StartScreenProps) {
  const { fileInputRef, error, triggerOpen, handleFileSelected } = useFileOpen({
    onSuccess: onFileOpened,
  });

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <img src="/icon.svg" alt="" width={64} height={64} />
        <h1 className="text-3xl font-semibold text-slate-900">BT Visualizer</h1>
        <p className="text-slate-600">
          Author, visualize, and validate behavior trees
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onNewTree}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-subtle hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            New Tree
          </button>
          <button
            type="button"
            onClick={triggerOpen}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Open File
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="start-screen-open-input"
          onChange={(e) => {
            void handleFileSelected(e);
          }}
        />
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
