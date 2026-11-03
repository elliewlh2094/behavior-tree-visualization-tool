import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { useBTStore } from '../../store/bt-store';
import type { BTTreeDef } from '../../core/model/node';

// 最小的 N（N >= 2），且 "Tree N" 尚未被用作樹名稱。從 2 開始，
// 因為初始的樹名為 "Main"；遇到使用者改名造成的衝突時會跳過
// （例如使用者把 Main 改名為 "Tree 2" → 下一個是 "Tree 3"）。
function nextTreeName(trees: ReadonlyArray<BTTreeDef>): string {
  const taken = new Set(trees.map((t) => t.name));
  for (let n = 2; n < taken.size + 3; n += 1) {
    const candidate = `Tree ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // 不可能到達：迴圈上限大於可能的最大衝突數。
  return `Tree ${taken.size + 1}`;
}

export function TabBar() {
  const trees = useBTStore((s) => s.document.trees);
  const mainTreeId = useBTStore((s) => s.document.mainTreeId);
  const activeTreeId = useBTStore((s) => s.activeTreeId);
  const setActiveTreeId = useBTStore((s) => s.setActiveTreeId);
  const addTree = useBTStore((s) => s.addTree);
  const renameTree = useBTStore((s) => s.renameTree);
  const deleteTree = useBTStore((s) => s.deleteTree);
  const reorderTrees = useBTStore((s) => s.reorderTrees);

  // 記住待刪除的樹，讓確認對話框只在分頁列層級渲染一次。
  // 在每個分頁上各自確認，會擠滿 140-180px 的分頁空間。
  const [pendingDelete, setPendingDelete] = useState<BTTreeDef | null>(null);

  // pointer sensor 的距離限制讓一般的點擊／雙擊仍能觸發（指標移動 5px 前
  // 不會開始拖曳），所以分頁啟用與雙擊改名在加入 DnD 後完全不受影響。
  // 觸控另外加上短暫的按壓延遲，讓捲動溢出的分頁列時不會被誤判為拖曳。
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    // 放在任何分頁之外（over === null）或放回原位 → 不重新排序，
    // 也不推入歷史紀錄。reorderTrees 本身也以防禦方式處理這種無變更的情況。
    if (!over || active.id === over.id) return;
    const ids = trees.map((t) => t.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderTrees(arrayMove(ids, oldIndex, newIndex));
  }

  // DndContext 包住整個分頁列，讓它視覺上隱藏的 ARIA 播報元素掛載為
  // 分頁列的同層元素，而不是在 tablist 內（role="status" 節點放在 tablist 內
  // 會觸發 axe 的 aria-required-children）。SortableContext 不渲染任何 DOM，
  // 所以分頁的 div 仍是 tablist 的直接子元素。
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex items-stretch"
        style={{
          backgroundColor: 'var(--bt-panel-bg)',
          borderBottom: '1px solid var(--bt-border)',
        }}
      >
        {/* 捲動區域帶有 role="tablist"，讓分頁按鈕成為 tablist 的直接子元素
            （axe-core 的 aria-required-children 只檢查直接子元素）。
            + 按鈕與確認對話框是 tablist 之外的同層元素，因為它們不是分頁。

            min-w-0 讓 flex 項目能縮小到比內容的自然尺寸更小；
            少了它，flexbox 不會縮小包裝元素，整個頁面本身就會開始捲動。 */}
        <div
          role="tablist"
          aria-label="Trees"
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
        >
          <SortableContext
            items={trees.map((t) => t.id)}
            strategy={horizontalListSortingStrategy}
          >
            {trees.map((t) => (
              <TreeTab
                key={t.id}
                tree={t}
                isMain={t.id === mainTreeId}
                isActive={t.id === activeTreeId}
                onActivate={() => setActiveTreeId(t.id)}
                onRename={(next) => renameTree(t.id, next)}
                onRequestDelete={() => setPendingDelete(t)}
              />
            ))}
          </SortableContext>
        </div>
        {/* + 放在捲動區域之外，所以即使建立的樹多到填滿分頁列，
            它也一定能被點到。 */}
        <button
          type="button"
          aria-label="Create new tree"
          title="Create a new tree"
          onClick={() => addTree(nextTreeName(trees))}
          className="flex flex-shrink-0 items-center px-3 text-lg leading-none transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 dark:hover:bg-slate-700"
          style={{
            color: 'var(--bt-text-secondary)',
          }}
        >
          +
        </button>
        {pendingDelete && (
          <ConfirmDeleteModal
            tree={pendingDelete}
            onConfirm={() => {
              deleteTree(pendingDelete.id);
              setPendingDelete(null);
            }}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </div>
    </DndContext>
  );
}

interface TreeTabProps {
  tree: BTTreeDef;
  isMain: boolean;
  isActive: boolean;
  onActivate: () => void;
  onRename: (next: string) => void;
  onRequestDelete: () => void;
}

function TreeTab({ tree, isMain, isActive, onActivate, onRename, onRequestDelete }: TreeTabProps) {
  const [editing, setEditing] = useState(false);

  // 改名期間停用拖曳，讓輸入框接收所有指標／鍵盤事件（AC-A6）。
  // setNodeRef 追蹤整個分頁（分頁作為一個整體移動）；
  // setActivatorNodeRef + listeners 讓內部的 role="tab" 按鈕成為拖曳把手，
  // × 按鈕則是不作為把手的同層元素。
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tree.id, disabled: editing });

  // flex-shrink-0 搭配父元素的 overflow-x-auto：分頁維持自然寬度
  // （140-180px），分頁列改為捲動，而不是壓縮分頁。
  // 只做水平位移（分頁列從不垂直移動分頁）；被拖曳的分頁會浮起並變暗，
  // 讓放下的位置清楚可辨。
  const wrapperStyle: React.CSSProperties = {
    minWidth: 140,
    maxWidth: 180,
    backgroundColor: isActive ? 'var(--bt-panel-bg)' : 'var(--bt-tab-inactive-bg)',
    color: isActive ? 'var(--bt-text-primary)' : 'var(--bt-text-secondary)',
    transform: transform ? `translate3d(${transform.x}px, 0, 0)` : undefined,
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.6 : undefined,
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        style={wrapperStyle}
        className="inline-flex flex-shrink-0 items-stretch"
      >
        <RenameInput
          initial={tree.name}
          onCommit={(next) => {
            onRename(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  // 啟用按鈕帶有 role=tab，讓鍵盤與輔助技術在每個分頁上只看到一個
  // 可取得焦點的元素。關閉用的 × 是同層元素，不是後代元素：
  // 按鈕內放按鈕是不合法的 HTML，也會讓分頁的無障礙名稱被迫包含
  // "Delete X"。dnd-kit 的 {...attributes}（role="button"、tabIndex、
  // 供螢幕閱讀器拖曳說明用的 aria-describedby）展開在 role="tab"／
  // aria-selected *之前*，讓分頁語意優先。
  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className="group inline-flex flex-shrink-0 items-stretch"
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        onClick={onActivate}
        onDoubleClick={() => setEditing(true)}
        title={tree.name}
        className="inline-flex min-w-0 flex-1 items-center gap-1.5 pl-4 pr-2 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500"
        style={{ color: 'inherit' }}
        {...attributes}
        {...listeners}
        role="tab"
        aria-selected={isActive}
      >
        {isMain && <HomeIcon />}
        <span className="truncate">{tree.name}</span>
      </button>
      {!isMain && (
        <button
          type="button"
          // 阻止指標事件傳到可排序的啟用元素，讓點擊 × 時執行刪除，
          // 而不是開始拖曳（AC-A5）。
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRequestDelete}
          aria-label={`Delete ${tree.name}`}
          title="Delete tree"
          className="flex w-6 items-center justify-center text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 group-hover:opacity-100 dark:hover:bg-slate-600 dark:hover:text-slate-100"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

interface ConfirmDeleteModalProps {
  tree: BTTreeDef;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteModal({ tree, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  // 掛載時把焦點移到 Cancel 按鈕，讓 Escape／Enter 的操作符合直覺，
  // 而且誤按 Enter 不會意外刪除（較安全的預設值）。
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // 按 Esc 關閉對話框。我們在 document 上監聽，
  // 因為取得焦點的元素可能是任一個按鈕。
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
      aria-labelledby="delete-tree-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        // 使用者點擊對話框內容時，阻止背景點擊處理器觸發。
        onClick={(e) => e.stopPropagation()}
        className="w-[min(28rem,90vw)] rounded-lg border p-5 shadow-xl"
        style={{
          backgroundColor: 'var(--bt-panel-bg)',
          borderColor: 'var(--bt-border)',
        }}
      >
        <h2
          id="delete-tree-title"
          className="text-base font-semibold"
          style={{ color: 'var(--bt-text-primary)' }}
        >
          Delete tree &ldquo;{tree.name}&rdquo;?
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--bt-text-secondary)' }}>
          SubTree references to this tree will become invalid. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface RenameInputProps {
  initial: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}

function RenameInput({ initial, onCommit, onCancel }: RenameInputProps) {
  const [draft, setDraft] = useState(initial);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  function commit(): void {
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === initial) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  }

  return (
    <div className="flex min-w-0 flex-1 items-center px-2 py-1">
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
            onCancel();
          }
        }}
        aria-label="Tree name"
        className="w-full rounded-md border px-2 py-0.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        style={{
          borderColor: 'var(--bt-border)',
          backgroundColor: 'var(--bt-panel-bg)',
          color: 'var(--bt-text-primary)',
        }}
      />
    </div>
  );
}

function HomeIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 7l6-5 6 5v7H2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
