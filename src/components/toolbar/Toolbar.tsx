import { useEffect, useRef, useState } from 'react';
import { useBTStore } from '../../store/bt-store';
import { serialize } from '../../core/serialization/serialize';
import { deserialize, type DeserializeError } from '../../core/serialization/deserialize';

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

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });
}

function formatError(err: DeserializeError): string {
  if (err.kind === 'parse') return err.message;
  const first = err.issues[0];
  if (!first) return 'Invalid tree file.';
  const path = first.path.length > 0 ? first.path.join('.') : '(root)';
  const more = err.issues.length > 1 ? ` (+${err.issues.length - 1} more)` : '';
  return `${path}: ${first.message}${more}`;
}

export function Toolbar() {
  const tree = useBTStore((s) => s.tree);
  const setTree = useBTStore((s) => s.setTree);
  const canUndo = useBTStore((s) => s.undoStack.items.length > 0);
  const canRedo = useBTStore((s) => s.redoStack.items.length > 0);
  const undo = useBTStore((s) => s.undo);
  const redo = useBTStore((s) => s.redo);
  const runValidation = useBTStore((s) => s.runValidation);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave(): void {
    setError(null);
    downloadBlob(serialize(tree), 'behavior-tree.json');
  }

  function handleOpenClick(): void {
    setError(null);
    fileInputRef.current?.click();
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
        handleOpenClick();
      } else if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) useBTStore.getState().redo();
        else useBTStore.getState().undo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // handleSave/handleOpenClick close over `tree` and `setError`; re-bind when tree changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await readFileAsText(file);
    const result = deserialize(text);
    if (!result.ok) {
      setError(formatError(result.error));
      return;
    }
    setTree(result.tree);
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <button
        type="button"
        onClick={handleOpenClick}
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
    </div>
  );
}
