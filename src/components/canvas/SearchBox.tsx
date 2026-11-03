import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { selectActiveTree, useBTStore } from '../../store/bt-store';
import { NODE_HEIGHT, NODE_WIDTH } from '../../core/config/grid';

// FR6 浮動節點搜尋（jsoncrack 模型）。以絕對定位放在畫布上方，
// 由 Ctrl+F 叫出（Toolbar 串接快捷鍵 → setSearchOpen）。
// 本元件持有查詢字串、有序的符合清單與目前索引；它把 searchMatchIds +
// searchCurrentId 寫入 store，讓 Canvas／BTNode 繪製琥珀色醒目標示。
// 關閉（Esc／×）時清除 store 中的這些狀態。
//
// 符合範圍只限使用中的樹（v1.11：跨樹搜尋不在範圍內），以不分大小寫的
// 子字串比對 node.name。逐一跳轉符合項時，透過 setCenter 把每個符合項
// 置中，並保留*目前的*縮放比例（見記憶：省略 zoom 時，xyflow 的
// setCenter 會把縮放跳回 1.0）。
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

  // 有序的符合項：名稱包含查詢字串（不分大小寫）的使用中樹節點，
  // 依節點陣列的次序排列，讓下一個／上一個的次序穩定。
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

  // 「讓索引 N 成為目前符合項」的單一進入點：記錄索引、
  // 把目前的 id 發佈到 store，並把鏡頭重新置中到該節點。
  const goToIndex = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      const node = matches[index];
      setCurrentId(node ? node.id : null);
      if (node) centerOn(node);
    },
    [matches, setCurrentId, centerOn],
  );

  // 只在符合集合本身改變時（查詢字串或樹的編輯）重新計算醒目標示：
  // 發佈 id 集合，並跳回第一個符合項（並將其置中）。
  // 刻意只以 `matches` 為相依：`goToIndex` 閉包包住 useReactFlow 的 getZoom，
  // 所以每次渲染身分都會改變。如果把它列在這裡，這個 effect 會在每次渲染時
  // 重新執行，並在使用者按下一個／上一個時把索引重設。
  // 導航以命令式呼叫 goToIndex，不透過這個 effect。
  useEffect(() => {
    setMatchIds(new Set(matches.map((n) => n.id)));
    goToIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // 每次搜尋列開啟時讓輸入框取得焦點，讓使用者可以立即輸入。
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
    setOpen(false); // store 會清除 searchMatchIds + searchCurrentId
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
      // focus-within 綠色光暈（標誌綠色，與節點的符合外框相同）
      // 表示「這個搜尋列是目前的編輯目標」，也就是輸入文字會進入的位置，
      // 以及按 Esc 會關閉的對象。只有輸入框持有焦點時才顯示外框。
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
