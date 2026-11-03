import { useCallback, useEffect, useRef, useState } from 'react';
import { selectActiveTree, useBTStore } from '../../store/bt-store';
import { serialize } from '../../core/serialization/serialize';
import { useApplyLayout } from '../../hooks/useApplyLayout';
import { useFileOpen } from '../../hooks/useFileOpen';
import { useResolvedTheme } from '../../hooks/useResolvedTheme';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import type { DiscardCopy } from '../common/UnsavedChangesModal';
import { ExportImageModal } from '../export/ExportImageModal';
import { MoveCopyModal } from '../move-copy/MoveCopyModal';

// 當 Open 會捨棄未存變更時顯示（經由共用對話框，見 AD10）。
// "Discard & open" 用來描述取代文件，文字比導航守衛的 "Leave page" 自然。
const OPEN_DISCARD_COPY: DiscardCopy = {
  title: 'Discard unsaved changes?',
  message: 'You have unsaved changes that will be lost if you open another file.',
  confirmLabel: 'Discard & open',
  cancelLabel: 'Cancel',
};

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

// 去除結尾的 `.json`（不分大小寫），讓編輯時能顯示並選取主檔名。
function stemOf(name: string): string {
  return name.replace(/\.json$/i, '');
}

// 如果使用者移除或改變了副檔名，就附加 `.json`。
// 名稱已經以 `.json`（任何大小寫）結尾時不做處理。
function ensureJsonExtension(name: string): string {
  return /\.json$/i.test(name) ? name : `${name}.json`;
}

// 所有工具列圖示採用相同的繪製風格：16 單位的 viewBox、以 14×14 渲染、
// currentColor 線條、strokeWidth 1.5、圓角線端。
// 視覺一致比各圖示專屬的隱喻更重要：工具列上的每個按鈕都屬於以下其中一類：
// 歷史紀錄（Undo／Redo）、檢查（Validate）、排列（Layout）、檔案（Open／Save）。

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

// 樹狀圖形：上方一個根節點，以線條連接兩個子節點。
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

// Open：從托盤中向上升起的箭頭。
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

// Save：向下沉入托盤的箭頭。
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

// Export：有外框的圖片（太陽 + 山），與檔案群組的圖示風格一致。
function ExportIcon() {
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
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="5.75" cy="6" r="1.1" />
      <path d="M2.5 12 6.5 8l2.5 2.5L11 8.5l2.5 3" />
    </svg>
  );
}

function MoveCopyIcon() {
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
      {/* 兩個堆疊的面板（來源／目的地），加上一個轉移箭頭。 */}
      <rect x="1.5" y="4" width="7" height="7" rx="1.25" />
      <rect x="7.5" y="2" width="7" height="7" rx="1.25" />
      <path d="M4.75 9.5 8 6.25" />
    </svg>
  );
}

function FileNameField() {
  const fileName = useBTStore((s) => s.fileName);
  const setFileName = useBTStore((s) => s.setFileName);
  const dirty = useBTStore((s) => s.dirty);
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
      // 空白（或只有 `.json`）：還原。
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

  // 輸入框掛載後，讓它取得焦點，並只選取主檔名
  // （讓使用者輸入時 `.json` 保持不變）。
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
        className="rounded-lg border px-2 py-0.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        style={{
          borderColor: 'var(--bt-border)',
          backgroundColor: 'var(--bt-panel-bg)',
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
      title={dirty ? 'Unsaved changes — click to rename' : 'Click to rename'}
      className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 dark:hover:bg-slate-700"
      style={{ color: 'var(--bt-text-secondary)' }}
    >
      {dirty && (
        <span
          data-testid="toolbar-dirty-dot"
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
        />
      )}
      {fileName}
    </button>
  );
}

export function Toolbar() {
  const resolvedTheme = useResolvedTheme();
  const document = useBTStore((s) => s.document);
  const fileName = useBTStore((s) => s.fileName);
  // 統一歷史堆疊中有項目時，啟用 Undo／Redo（v1.7.1）。
  // 歷史紀錄屬於文件層級，不以分頁區分，所以使用中的分頁無關。
  const canUndo = useBTStore((s) => s.undoStack.items.length > 0);
  const canRedo = useBTStore((s) => s.redoStack.items.length > 0);
  const undo = useBTStore((s) => s.undo);
  const redo = useBTStore((s) => s.redo);
  const runValidation = useBTStore((s) => s.runValidation);
  const applyLayout = useApplyLayout();
  const { fileInputRef, error, clearError, triggerOpen, handleFileSelected } = useFileOpen();
  // 開啟檔案會取代整份文件；讓它經過共用的未存變更對話框（AD10），
  // 而不是另外使用 window.confirm。
  const requestDiscard = useUnsavedGuard();
  const openFile = useCallback(
    () => requestDiscard(triggerOpen, OPEN_DISCARD_COPY),
    [requestDiscard, triggerOpen],
  );
  // Export 只在（理論上的）沒有 Root 的空樹狀態下停用；
  // 只有 Root 的樹會匯出單一節點的 PNG（AC1.2）。
  const nodeCount = useBTStore((s) => selectActiveTree(s).nodes.length);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Move/Copy 需要至少一個被選取的節點，以及第二棵樹作為目標。
  const selectedNodeCount = useBTStore((s) => s.selection.nodeIds.size);
  const treeCount = useBTStore((s) => s.document.trees.length);
  const canMoveCopy = selectedNodeCount >= 1 && treeCount >= 2;
  const moveCopyTitle =
    treeCount < 2
      ? 'Add another tree to enable move/copy'
      : selectedNodeCount < 1
        ? 'Select one or more nodes to move or copy'
        : 'Move or copy selection to another tree…';
  const [moveCopyModalOpen, setMoveCopyModalOpen] = useState(false);

  function handleSave(): void {
    clearError();
    downloadBlob(serialize(document), fileName);
    // 下載就是儲存；重新設定 dirty 的基準，讓 `●` 指示符號與
    // beforeunload 守衛清除（FR9）。
    useBTStore.getState().markSaved();
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
        openFile();
      } else if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) useBTStore.getState().redo();
        else useBTStore.getState().undo();
      } else if (key === 'a') {
        // 讓文字欄位內的原生全選正常運作。
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useBTStore.getState().selectAll();
      } else if (key === 'd') {
        // 在欄位中輸入時略過，讓輸入框內的 Ctrl+D 不會搶走焦點；
        // 在畫布上，preventDefault 會吞掉瀏覽器預設的「將此頁加入書籤」動作。
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useBTStore.getState().duplicateSelection();
      } else if (key === 'f') {
        // FR6 搜尋。在可編輯欄位中，讓瀏覽器的原生搜尋照常運作
        // （SearchBox 的輸入框本身是可編輯的，所以在那裡再按一次 Ctrl+F
        // 不會被攔截）。在畫布上，阻止瀏覽器的頁內搜尋，並開啟我們的浮動 SearchBox。
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        useBTStore.getState().setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // handleSave 閉包包住 `document` 與 `fileName`；兩者任一改變時重新綁定，
    // 讓 Ctrl+S 以目前的名稱序列化最新的文件。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, fileName]);

  // 按鈕採用一致的外形：圖示（14×14）+ 標籤、slate-600 邊框以呈現介面外框
  // 的份量、與 --bt-panel-bg 相同的 slate-50 靜止背景，hover 時變為白色。
  // 停用狀態降低飽和度，但不改變版面。
  const buttonClass =
    'flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm font-medium hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 dark:hover:bg-slate-700';
  const buttonStyle = {
    borderColor: 'var(--bt-border)',
    color: 'var(--bt-text-primary)',
    backgroundColor: 'var(--bt-panel-bg)',
  } as const;
  // disabled:opacity-50 是可見的停用訊號：Tailwind 的 disabled:text-* 會被
  // 同一元素上的行內 `style.color` 覆蓋。
  // opacity 與行內樣式能正確疊加。
  const disabledButtonClass =
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--bt-panel-bg)] dark:disabled:hover:bg-slate-800';

  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-2"
      style={{
        backgroundColor: 'var(--bt-panel-bg)',
        borderColor: 'var(--bt-border)',
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}${resolvedTheme === 'dark' ? 'icon-dark.svg' : 'icon.svg'}`}
        alt=""
        width={24}
        height={24}
      />
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
      <Separator />
      <button
        type="button"
        onClick={() => setMoveCopyModalOpen(true)}
        disabled={!canMoveCopy}
        title={moveCopyTitle}
        aria-label="Move or copy selection"
        className={`${buttonClass} ${disabledButtonClass}`}
        style={buttonStyle}
      >
        <MoveCopyIcon />
        <span>Move / Copy</span>
      </button>
      {error && (
        <p
          role="alert"
          className="ml-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}
      <div className="flex-1" />
      <FileNameField />
      <Separator />
      <button
        type="button"
        onClick={openFile}
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
      <button
        type="button"
        onClick={() => setExportModalOpen(true)}
        disabled={nodeCount === 0}
        title={
          nodeCount === 0
            ? 'Add a node before exporting'
            : 'Export tree as PNG'
        }
        aria-label="Export image"
        className={`${buttonClass} ${disabledButtonClass}`}
        style={buttonStyle}
      >
        <ExportIcon />
        <span>Export</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="toolbar-open-input"
        onChange={handleFileSelected}
      />
      {exportModalOpen && (
        <ExportImageModal onClose={() => setExportModalOpen(false)} />
      )}
      {moveCopyModalOpen && (
        <MoveCopyModal onClose={() => setMoveCopyModalOpen(false)} />
      )}
    </div>
  );
}

// 工具列群組之間的垂直細線。比 --bt-border 淺，
// 讓它看起來是視覺上的間隔，而不是另一道牆。
function Separator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-700" />;
}
