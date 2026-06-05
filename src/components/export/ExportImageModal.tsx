import { useEffect, useRef, useState } from 'react';
import { selectActiveTree, useBTStore, type ExportMode } from '../../store/bt-store';
import { useExportImage } from '../../hooks/useExportImage';
import { ensurePngExtension } from './export-filename';

interface ExportImageModalProps {
  onClose: () => void;
}

const MODES: { value: ExportMode; label: string }[] = [
  { value: 'themed', label: 'Themed background' },
  { value: 'transparent', label: 'Transparent' },
];

// Default export name combines the document file name with the active tree's
// name (e.g. `pacman.json` + `Main` → `pacman-Main.png`) so per-tree exports
// from the same document are distinguishable. Strips the `.json` document
// extension; the `.png` is added on export.
function defaultExportName(fileName: string, treeName: string): string {
  const stem = fileName.replace(/\.json$/i, '').trim();
  return stem ? `${stem}-${treeName}.png` : `${treeName}.png`;
}

export function ExportImageModal({ onClose }: ExportImageModalProps) {
  const treeName = useBTStore((s) => selectActiveTree(s).name);
  const fileName = useBTStore((s) => s.fileName);
  const exportImage = useExportImage();

  const [mode, setMode] = useState<ExportMode>('themed');
  const [filename, setFilename] = useState(() =>
    defaultExportName(fileName, treeName),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Esc closes (listen on document — focus may be on any control).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const canExport = filename.trim() !== '' && !busy;

  async function handleExport(): Promise<void> {
    if (!canExport) return;
    setBusy(true);
    setError(null);
    try {
      await exportImage({ mode, filename: ensurePngExtension(filename.trim()) });
      onClose();
    } catch (e) {
      // Keep the modal open with the failure inline; the flag is already
      // cleared by useExportImage's finally block (AC1.15).
      setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-image-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(28rem,90vw)] rounded-lg border p-5 shadow-xl"
        style={{
          backgroundColor: 'var(--bt-panel-bg)',
          borderColor: 'var(--bt-border)',
        }}
      >
        <h2
          id="export-image-title"
          className="text-base font-semibold"
          style={{ color: 'var(--bt-text-primary)' }}
        >
          Export tree as PNG
        </h2>

        <fieldset className="mt-4">
          <legend
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--bt-text-secondary)' }}
          >
            Background
          </legend>
          <div
            className="mt-1.5 inline-flex rounded-lg border p-0.5"
            style={{ borderColor: 'var(--bt-border)' }}
            role="radiogroup"
            aria-label="Background"
          >
            {MODES.map((m) => {
              const selected = mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(m.value)}
                  className="rounded-md px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={
                    selected
                      ? { backgroundColor: 'var(--bt-accent, #0284c7)', color: '#ffffff' }
                      : { color: 'var(--bt-text-secondary)' }
                  }
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label
          className="mt-4 block text-xs font-medium uppercase tracking-wide"
          style={{ color: 'var(--bt-text-secondary)' }}
        >
          File name
          <input
            ref={inputRef}
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleExport();
              }
            }}
            aria-label="File name"
            className="mt-1 w-full rounded-lg border px-2 py-1 text-sm normal-case tracking-normal focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            style={{
              borderColor: 'var(--bt-border)',
              backgroundColor: 'var(--bt-panel-bg)',
              color: 'var(--bt-text-primary)',
            }}
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={!canExport}
            className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50"
          >
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
