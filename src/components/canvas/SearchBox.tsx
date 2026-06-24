import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { selectActiveTree, useBTStore } from '../../store/bt-store';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';

// FR6 floating node search (jsoncrack model). Absolute-positioned over the
// canvas, summoned by Ctrl+F (Toolbar wires the shortcut → setSearchOpen). The
// component owns the query, the ordered match list, and the current index;
// it writes searchMatchIds + searchCurrentId to the store so Canvas/BTNode can
// paint the amber highlights. Closing (Esc / ×) clears that store state.
//
// Match scope is the ACTIVE tree only (v1.11 — cross-tree search is out of
// scope), filtered by case-insensitive substring over node.name. Stepping
// through matches centers each via setCenter with the *current* zoom preserved
// (memory: xyflow setCenter snaps zoom to 1.0 when zoom is omitted).
export function SearchBox() {
  const open = useBTStore((s) => s.searchOpen);
  const setOpen = useBTStore((s) => s.setSearchOpen);
  const setMatchIds = useBTStore((s) => s.setSearchMatchIds);
  const setCurrentId = useBTStore((s) => s.setSearchCurrentId);
  const tree = useBTStore(selectActiveTree);
  const { setCenter, getZoom } = useReactFlow();

  const [query, setQuery] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ordered matches: active-tree nodes whose name contains the query
  // (case-insensitive), in node-array order so next/prev is stable.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tree.nodes.filter((n) => n.name.toLowerCase().includes(q));
  }, [query, tree.nodes]);

  const centerOn = useCallback(
    (node: { position: { x: number; y: number } }) => {
      setCenter(
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2,
        { zoom: getZoom(), duration: 200 },
      );
    },
    [setCenter, getZoom],
  );

  // Single entry point for "make index N the current match": tracks the index,
  // publishes the current id to the store, and recenters the camera on it.
  const goToIndex = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      const node = matches[index];
      setCurrentId(node ? node.id : null);
      if (node) centerOn(node);
    },
    [matches, setCurrentId, centerOn],
  );

  // Recompute highlights ONLY when the match set itself changes (query or tree
  // edits): publish the id set and snap back to the first match (centering it).
  // Deliberately keyed on `matches` alone — `goToIndex` changes identity every
  // render (it closes over useReactFlow's getZoom), and listing it here would
  // re-run this effect on every render and reset the index out from under
  // next/prev. Navigation goes through goToIndex imperatively, not this effect.
  useEffect(() => {
    setMatchIds(new Set(matches.map((n) => n.id)));
    goToIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // Focus the input each time the box opens so the user types immediately.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const total = matches.length;
  const next = useCallback(() => {
    if (total > 0) goToIndex((currentIndex + 1) % total);
  }, [total, currentIndex, goToIndex]);
  const prev = useCallback(() => {
    if (total > 0) goToIndex((currentIndex - 1 + total) % total);
  }, [total, currentIndex, goToIndex]);

  const close = useCallback(() => {
    setOpen(false); // store clears searchMatchIds + searchCurrentId
    setQuery('');
  }, [setOpen]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      prev();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!open) return null;

  return (
    <div
      // focus-within green glow (logo green, matching the node match ring)
      // signals "this box is the active edit target" — i.e. where typing lands
      // and where Esc closes. The ring only shows while the input holds focus.
      className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-md transition-shadow focus-within:border-[#00a63e] focus-within:ring-2 focus-within:ring-[#00a63e]/40 dark:border-slate-600 dark:bg-slate-800"
      role="search"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search nodes…"
        aria-label="Search nodes in current tree"
        className="w-44 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      <span
        className="min-w-[3.5rem] select-none text-right text-xs tabular-nums text-slate-500 dark:text-slate-400"
        title="Matches in current tree"
        aria-live="polite"
      >
        {total > 0 ? `${currentIndex + 1}/${total}` : `0/0`}
        <span className="ml-1 hidden sm:inline">(tree)</span>
      </span>
      <button
        type="button"
        onClick={prev}
        disabled={total === 0}
        aria-label="Previous match"
        title="Previous match (Shift+Enter / ↑)"
        className="rounded px-1.5 py-0.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={next}
        disabled={total === 0}
        aria-label="Next match"
        title="Next match (Enter / ↓)"
        className="rounded px-1.5 py-0.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={close}
        aria-label="Close search"
        title="Close (Esc)"
        className="rounded px-1.5 py-0.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        ×
      </button>
    </div>
  );
}
