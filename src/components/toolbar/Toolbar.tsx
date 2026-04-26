import { useEffect } from 'react';
import { useBTStore } from '../../store/bt-store';
import { serialize } from '../../core/serialization/serialize';
import { useFileOpen } from '../../hooks/useFileOpen';

function downloadBlob(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function Toolbar() {
  const tree = useBTStore((s) => s.tree);
  const fileName = useBTStore((s) => s.fileName);
  const canUndo = useBTStore((s) => s.undoStack.items.length > 0);
  const canRedo = useBTStore((s) => s.redoStack.items.length > 0);
  const undo = useBTStore((s) => s.undo);
  const redo = useBTStore((s) => s.redo);
  const runValidation = useBTStore((s) => s.runValidation);
  const { fileInputRef, error, clearError, triggerOpen, handleFileSelected } = useFileOpen();

  function handleSave(): void {
    clearError();
    downloadBlob(serialize(tree), fileName);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        handleSave();
      } else if (key === 'o') {
        e.preventDefault();
        triggerOpen();
      } else if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) useBTStore.getState().redo();
        else useBTStore.getState().undo();
      } else if (key === 'a') {
        // Let native Select-All work inside text fields.
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useBTStore.getState().selectAll();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // handleSave closes over `tree` and `fileName`; re-bind when either changes
    // so Ctrl+S serializes the latest tree under the current name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, fileName]);

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <img src="/icon.svg" alt="" width={24} height={24} />
      <span className="text-sm font-semibold text-slate-900">BT Visualizer</span>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button
        type="button"
        onClick={triggerOpen}
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        Open
      </button>
      <button
        type="button"
        onClick={handleSave}
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        Save
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        aria-label="Undo"
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-slate-50"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        aria-label="Redo"
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-slate-50"
      >
        Redo
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button
        type="button"
        onClick={runValidation}
        aria-label="Validate tree"
        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        Validate
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="toolbar-open-input"
        onChange={handleFileSelected}
      />
      {error && (
        <p
          role="alert"
          className="ml-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex-1" />
      <span
        data-testid="toolbar-filename"
        className="text-sm text-slate-600 cursor-pointer"
      >
        {fileName}
      </span>
    </div>
  );
}
