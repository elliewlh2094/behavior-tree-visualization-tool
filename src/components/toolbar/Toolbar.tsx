import { useEffect, useRef, useState } from 'react';
import { useBTStore } from '../../store/bt-store';
import { serialize } from '../../core/serialization/serialize';
import { useApplyLayout } from '../../hooks/useApplyLayout';
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

// All toolbar icons share the same drawing style: 16-unit viewBox, 14×14
// rendered, currentColor stroke at strokeWidth 1.5, rounded line ends.
// Keeping them visually consistent matters more than icon-specific
// metaphors — every button on the toolbar is one of: history (Undo/Redo),
// inspect (Validate), arrange (Layout), file (Open/Save).

function UndoIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      <path d="M3 6h7a3.5 3.5 0 0 1 0 7H6" />
      <path d="M5.5 3 3 6l2.5 3" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      <path d="M13 6H6a3.5 3.5 0 0 0 0 7h4" />
      <path d="M10.5 3 13 6l-2.5 3" />
    </svg>
  );
}

function ValidateIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      <path d="M8 2 14.5 13H1.5L8 2z" />
      <line x1="8" y1="6.5" x2="8" y2="9.5" />
      <line x1="8" y1="11" x2="8" y2="11.5" />
    </svg>
  );
}

// Tree-like glyph: a root node up top with two child nodes connected by lines.
function LayoutIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width={14}
      height={14}
      aria-hidden
    >
      <rect x="6" y="1.5" width="4" height="3" rx="0.5" />
      <rect x="1.5" y="11" width="4" height="3" rx="0.5" />
      <rect x="10.5" y="11" width="4" height="3" rx="0.5" />
      <line x1="8" y1="4.5" x2="8" y2="7.5" />
      <line x1="3.5" y1="11" x2="3.5" y2="7.5" />
      <line x1="12.5" y1="11" x2="12.5" y2="7.5" />
      <line x1="3.5" y1="7.5" x2="12.5" y2="7.5" />
    </svg>
  );
}

// Open: upward arrow rising out of a tray.
function OpenIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      <line x1="8" y1="2" x2="8" y2="10" />
      <path d="M5 5 8 2l3 3" />
      <path d="M2.5 11v2.5h11V11" />
    </svg>
  );
}

// Save: downward arrow sinking into a tray.
function SaveIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      <line x1="8" y1="2" x2="8" y2="10" />
      <path d="M5 7 8 10l3-3" />
      <path d="M2.5 11v2.5h11V11" />
    </svg>
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
        className="rounded-lg border bg-white px-2 py-0.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        style={{
          borderColor: 'var(--bt-border)',
          color: 'var(--bt-text-primary)',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      data-testid="toolbar-filename"
      title="Click to rename"
      className="rounded-lg px-2 py-0.5 text-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
      style={{ color: 'var(--bt-text-secondary)' }}
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
  const applyLayout = useApplyLayout();
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

  // Buttons share a consistent shape: icon (14×14) + label, slate-600 border
  // for chrome heaviness, slate-50 resting bg matching --bt-panel-bg, and
  // hover lifts to white. Disabled state desaturates without losing layout.
  const buttonClass =
    'flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-medium hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500';
  const buttonStyle = {
    borderColor: 'var(--bt-border)',
    color: 'var(--bt-text-primary)',
    backgroundColor: 'var(--bt-panel-bg)',
  } as const;
  const disabledButtonClass =
    'disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-[var(--bt-panel-bg)]';

  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-2"
      style={{
        backgroundColor: 'var(--bt-panel-bg)',
        borderColor: 'var(--bt-border)',
      }}
    >
      <img src="/icon.svg" alt="" width={24} height={24} />
      <span
        className="text-xl font-semibold leading-none"
        style={{ color: 'var(--bt-text-primary)' }}
      >
        BT Visualizer
      </span>
      <Separator />
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        aria-label="Undo"
        className={`${buttonClass} ${disabledButtonClass}`}
        style={buttonStyle}
      >
        <UndoIcon />
        <span>Undo</span>
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        aria-label="Redo"
        className={`${buttonClass} ${disabledButtonClass}`}
        style={buttonStyle}
      >
        <RedoIcon />
        <span>Redo</span>
      </button>
      <Separator />
      <button
        type="button"
        onClick={runValidation}
        aria-label="Validate tree"
        className={buttonClass}
        style={buttonStyle}
      >
        <ValidateIcon />
        <span>Validate</span>
      </button>
      <Separator />
      <button
        type="button"
        onClick={applyLayout}
        aria-label="Auto layout"
        title="Auto layout (re-organize tree)"
        className={buttonClass}
        style={buttonStyle}
      >
        <LayoutIcon />
        <span>Layout</span>
      </button>
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
      <Separator />
      <button
        type="button"
        onClick={triggerOpen}
        className={buttonClass}
        style={buttonStyle}
      >
        <OpenIcon />
        <span>Open</span>
      </button>
      <button
        type="button"
        onClick={handleSave}
        className={buttonClass}
        style={buttonStyle}
      >
        <SaveIcon />
        <span>Save</span>
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

// Vertical hairline between toolbar groups. Lighter than --bt-border so
// it reads as a visual breather, not another wall.
function Separator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-slate-300" />;
}
