import { useEffect, useRef } from 'react';

/** Copy for one unsaved-changes confirmation, varied per context. */
export interface DiscardCopy {
  title: string;
  message: string;
  /** Destructive action label, e.g. "Leave page" / "Discard & open". */
  confirmLabel: string;
  /** Safe default label, e.g. "Stay on page" / "Cancel". */
  cancelLabel: string;
}

interface UnsavedChangesModalProps extends DiscardCopy {
  /** Run the destructive action (proceed with nav / replace the document). */
  onConfirm: () => void;
  /** Cancel — the safe default (autofocused; Esc and backdrop map to it). */
  onCancel: () => void;
}

/**
 * Single confirmation UI for every app-controllable action that would discard
 * the current document's unsaved changes — in-app navigation away (router
 * blocker) and document-replacing actions like Open (AD10). One visual shell;
 * the copy is passed in so each context reads naturally ("Leave page" for nav,
 * "Discard & open" for Open). Browser close/refresh is intentionally NOT routed
 * here — it can only use the native, uncustomizable beforeunload dialog.
 */
export function UnsavedChangesModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: UnsavedChangesModalProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
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
          id="unsaved-changes-title"
          className="text-base font-semibold"
          style={{ color: 'var(--bt-text-primary)' }}
        >
          {title}
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--bt-text-secondary)' }}>
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
