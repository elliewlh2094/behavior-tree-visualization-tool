import { useEffect, useRef, useState } from 'react';
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

// Strip a trailing `.json` (case-insensitive) so we can show + select the stem on edit.
function stemOf(name: string): string {
  return name.replace(/\.json$/i, '');
}

// Append `.json` if the user removed or changed the extension. Leaves a name
// already ending in `.json` (any case) alone.
function ensureJsonExtension(name: string): string {
  return /\.json$/i.test(name) ? name : `${name}.json`;
}

interface GridToggleProps {
  showGrid: boolean;
  onToggle: () => void;
}

function GridToggle({ showGrid, onToggle }: GridToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={showGrid}
      aria-label="Toggle grid"
      title={showGrid ? 'Hide grid' : 'Show grid'}
      onClick={onToggle}
      className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
    >
      <span>Grid</span>
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          showGrid ? 'bg-sky-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            showGrid ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function FileNameField() {
  const fileName = useBTStore((s) => s.fileName);
  const setFileName = useBTStore((s) => s.setFileName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  function startEdit(): void {
    setDraft(fileName);
    setEditing(true);
  }

  function commit(): void {
    const trimmed = draft.trim();
    const stem = stemOf(trimmed);
    if (stem === '') {
      // Empty (or just `.json`) — revert.
      setEditing(false);
      return;
    }
    const next = ensureJsonExtension(trimmed);
    if (next !== fileName) setFileName(next);
    setEditing(false);
  }

  function cancel(): void {
    setEditing(false);
  }

  // After the input mounts, focus it and select only the stem (so `.json`
  // stays put when the user types).
  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const stemLen = stemOf(el.value).length;
    el.setSelectionRange(0, stemLen);
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        data-testid="toolbar-filename-input"
        aria-label="File name"
        className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      data-testid="toolbar-filename"
      title="Click to rename"
      className="rounded-lg px-2 py-0.5 text-sm text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
    >
      {fileName}
    </button>
  );
}

export function Toolbar() {
  const tree = useBTStore((s) => s.tree);
  const fileName = useBTStore((s) => s.fileName);
  const canUndo = useBTStore((s) => s.undoStack.items.length > 0);
  const canRedo = useBTStore((s) => s.redoStack.items.length > 0);
  const undo = useBTStore((s) => s.undo);
  const redo = useBTStore((s) => s.redo);
  const runValidation = useBTStore((s) => s.runValidation);
  const showGrid = useBTStore((s) => s.showGrid);
  const toggleGrid = useBTStore((s) => s.toggleGrid);
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

  const buttonClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500';
  const disabledButtonClass =
    'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:border-slate-200 disabled:hover:bg-slate-50';

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <img src="/icon.svg" alt="" width={24} height={24} />
      <span className="text-xl font-semibold leading-none text-slate-900">
        BT Visualizer
      </span>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        aria-label="Undo"
        className={`${buttonClass} ${disabledButtonClass}`}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        aria-label="Redo"
        className={`${buttonClass} ${disabledButtonClass}`}
      >
        Redo
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button
        type="button"
        onClick={runValidation}
        aria-label="Validate tree"
        className={buttonClass}
      >
        Validate
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <GridToggle showGrid={showGrid} onToggle={toggleGrid} />
      {error && (
        <p
          role="alert"
          className="ml-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex-1" />
      <FileNameField />
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button type="button" onClick={triggerOpen} className={buttonClass}>
        Open
      </button>
      <button type="button" onClick={handleSave} className={buttonClass}>
        Save
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="toolbar-open-input"
        onChange={handleFileSelected}
      />
    </div>
  );
}
