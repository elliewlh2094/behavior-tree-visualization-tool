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

// Smallest N >= 2 such that "Tree N" is not already a tree name. Starts at 2
// because the seed tree is named "Main"; jumps over any user-renamed
// collisions (e.g. user renamed Main to "Tree 2" → next is "Tree 3").
function nextTreeName(trees: ReadonlyArray<BTTreeDef>): string {
  const taken = new Set(trees.map((t) => t.name));
  for (let n = 2; n < taken.size + 3; n += 1) {
    const candidate = `Tree ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Unreachable: the loop bound exceeds the max possible collisions.
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

  // Hold the tree pending delete so the confirmation modal can render once at
  // the bar level. Per-tab confirmation crowded the 140-180px tab footprint.
  const [pendingDelete, setPendingDelete] = useState<BTTreeDef | null>(null);

  // Distance constraint on the pointer sensor lets a plain click/double-click
  // still fire (no drag starts until the pointer moves 5px), so tab activation
  // and double-click-to-rename survive the DnD wiring untouched. Touch adds a
  // short press-delay so scrolling the overflow strip isn't hijacked as a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    // Dropped outside any tab (over === null) or back in place → no reorder,
    // no history push. reorderTrees also guards the no-op case defensively.
    if (!over || active.id === over.id) return;
    const ids = trees.map((t) => t.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderTrees(arrayMove(ids, oldIndex, newIndex));
  }

  // DndContext wraps the whole bar so its visually-hidden ARIA announcer
  // mounts as a sibling of the bar, not inside the tablist (where a
  // role="status" node would trip axe's aria-required-children). SortableContext
  // renders no DOM, so the tab divs stay direct children of the tablist.
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
        {/* Scroll region carries role="tablist" so the tab buttons are direct
            children of the tablist (axe-core's aria-required-children walks
            direct children only). The + button and confirm modal are siblings
            outside the tablist — they aren't tabs.

            min-w-0 lets the flex item shrink below its content's natural size;
            without it, flexbox refuses to shrink the wrapper and the page
            itself starts to scroll. */}
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
        {/* + lives outside the scroll region so it's always reachable, even
            after creating enough trees to fill the bar. */}
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

  // Dragging is disabled while renaming so the input owns all pointer/keyboard
  // events (AC-A6). setNodeRef tracks the whole tab (it transforms as a unit);
  // setActivatorNodeRef + listeners make the inner role="tab" button the grab
  // handle, leaving the × button a non-handle sibling.
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tree.id, disabled: editing });

  // flex-shrink-0 paired with the parent's overflow-x-auto: tabs hold their
  // natural width (140-180px) and the strip scrolls instead of compressing.
  // Horizontal-only translate (the strip never moves tabs vertically); lift +
  // dim the dragged tab so the drop position reads clearly.
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

  // The activation button carries role=tab so keyboard + assistive tech see a
  // single focusable element per tab. The close × is a sibling, not a
  // descendant — button-in-button is invalid HTML and would also force the
  // tab's accessible name to include "Delete X". dnd-kit's {...attributes}
  // (role="button", tabIndex, aria-describedby for the SR drag instructions)
  // are spread BEFORE role="tab"/aria-selected so the tab semantics win.
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
          // Stop the pointer from reaching the sortable activator so clicking ×
          // deletes instead of starting a drag (AC-A5).
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
  // Move focus to the Cancel button on mount so Escape/Enter feel natural and
  // a stray Enter press doesn't accidentally delete (the safer default).
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Esc closes the modal. We listen on the document because the focused
  // element may be either button.
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
        // Stop backdrop-click handler from firing when the user clicks inside
        // the dialog body.
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
