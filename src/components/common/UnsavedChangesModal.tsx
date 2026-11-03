import { useEffect, useRef } from 'react';

/** 一則未存變更確認的文案，依情境而不同。 */
export interface DiscardCopy {
  title: string;
  message: string;
  /** 破壞性動作的標籤，例如 "Leave page"／"Discard & open"。 */
  confirmLabel: string;
  /** 安全預設選項的標籤，例如 "Stay on page"／"Cancel"。 */
  cancelLabel: string;
}

interface UnsavedChangesModalProps extends DiscardCopy {
  /** 執行破壞性動作（繼續導航／取代文件）。 */
  onConfirm: () => void;
  /** 取消：安全的預設選項（自動取得焦點；Esc 與點擊背景都對應到它）。 */
  onCancel: () => void;
}

/**
 * 單一的確認 UI，用於每一個會捨棄目前文件未存變更、且由應用程式控制的動作：
 * 應用程式內的離開導航（路由阻擋器），以及取代文件的動作，例如 Open（AD10）。
 * 只有一個視覺外殼；文案由外部傳入，讓每個情境的文字都自然
 * （導航用 "Leave page"，Open 用 "Discard & open"）。
 * 瀏覽器的關閉／重新整理刻意*不*經過這裡，因為它只能使用原生、
 * 無法自訂的 beforeunload 對話框。
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
