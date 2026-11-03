import { create } from 'zustand';
import type { BTDocument, BTNode, BTTreeDef, NodeKind } from '../core/model/node';
import { createEmptyDocument } from '../core/model/tree';
import {
  addNode,
  connect,
  disconnect,
  duplicateSelection,
  moveCopySelection,
  moveNode,
  removeNode,
  reorderChildren,
  updateNode,
} from '../core/model/operations';
import { GRID_SIZE } from '../core/config/grid';
import {
  clear,
  createRingBuffer,
  peek,
  pop,
  push,
  type RingBuffer,
} from '../core/history/ring-buffer';
import { validate } from '../core/validation';
import type { ValidationIssue } from '../core/validation/types';

export type Selection = {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
};

export const EMPTY_SELECTION: Selection = {
  nodeIds: new Set(),
  edgeIds: new Set(),
};

export function isEmptySelection(s: Selection): boolean {
  return s.nodeIds.size === 0 && s.edgeIds.size === 0;
}

export const HISTORY_CAPACITY = 10;

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

// v1.9：暫態的圖片匯出模式。只屬於 UI，由 Canvas／BTNode 讀取，
// 用來在擷取期間隱藏覆蓋層。*不*屬於 DocSnapshot，也永遠不推入歷史紀錄
// （zustand 會合併狀態，所以 setDocument／undo／redo 不會動到它）。
export type ExportMode = 'transparent' | 'themed';

// v1.7.1：歷史紀錄是一條依時間排序、由完整文件快照組成的時間軸。
// 每個會變更文件的 action（單樹編輯，*以及* renameTree／addTree／deleteTree
// 這類跨樹變更）都會推入一個 DocSnapshot，記錄 action 執行*之前*的
// 文件 + activeTreeId。分頁只是這條時間軸上的 UI 投影：切換分頁永遠
// 不會推入歷史紀錄，也不會影響下一個被還原的 action。
export type DocSnapshot = {
  document: BTDocument;
  activeTreeId: string;
};

export interface BTStoreState {
  document: BTDocument;
  activeTreeId: string;
  selection: Selection;
  // 單一統一的歷史時間軸。彈出時，把目前的狀態推入相反的堆疊
  // （undo→redo、redo→undo）。上限為 HISTORY_CAPACITY。
  undoStack: RingBuffer<DocSnapshot>;
  redoStack: RingBuffer<DocSnapshot>;
  // 每棵樹的視口（xyflow 的 x／y／zoom）。Canvas 在 onMoveEnd 時寫入，
  // 在 activeTreeId 改變時讀取；沒有項目時改用 DEFAULT_VIEWPORT
  // （新建立的分頁從原點置中開始）。
  // 不屬於歷史紀錄，undo/redo 時保持不變。
  viewportByTreeId: Record<string, Viewport>;
  validationIssues: ValidationIssue[] | null;
  fileName: string;
  // v1.9 圖片匯出：暫態的 UI 旗標，不在歷史紀錄中。閒置時為 null。
  exportInProgress: ExportMode | null;
  setExportInProgress: (mode: ExportMode | null) => void;
  // v1.11 FR6 節點搜尋。三個欄位都是暫態的 UI 狀態：使用不經過
  // withSnapshot 的一般 setter，所以開啟搜尋或重新計算符合項永遠不會
  // 動到 undo/redo（與 exportInProgress 相同的模式）。SearchBox 負責
  // 篩選與導航，並把結果寫到這裡，供 Canvas → BTNode 讀取。
  //   searchMatchIds：名稱符合查詢字串的使用中樹節點 id（琥珀色的
  //     「是符合項」外框；沒有次序，讓 BTNode 以 O(1) 判斷成員）。
  //   searchCurrentId：使用者目前停留的那一個節點（更明顯的「目前符合項」
  //     外框 + 被置中的節點）。偏離 SPEC-v1.11 FR6 的兩欄位清單：
  //     Set 無法表達「N 個中的哪一個是目前的」，而目前符合項的醒目標示
  //     （todo T9）需要這項資訊。
  searchOpen: boolean;
  searchMatchIds: ReadonlySet<string>;
  searchCurrentId: string | null;
  setSearchOpen: (open: boolean) => void;
  setSearchMatchIds: (ids: ReadonlySet<string>) => void;
  setSearchCurrentId: (id: string | null) => void;
  // v1.11 FR9 未存變更守衛。`dirty` 是*推導*出來的，不是由各 action 設定：
  // 一個模組層級的訂閱（位於本檔案底部）在 `document` 的參照與
  // `lastSavedDocument` 不同時，把它設為 true。兩者都是暫態的 UI 狀態，
  // 永遠不在 DocSnapshot 中，也永遠不推入歷史紀錄。
  // `setDocument`／`markSaved` 重設基準（清除 dirty）；沒有實際變更的 action
  // 回傳 `{}` 並保留 `document` 參照，所以 dirty 永遠不會被誤設。
  // 見 SPEC-v1.11 FR9／已決議決策 #8。
  dirty: boolean;
  lastSavedDocument: BTDocument;
  // 把目前的文件標記為已儲存的基準：讓 lastSavedDocument 指向目前的文件，
  // 藉此清除 dirty。Toolbar 在儲存後呼叫。
  markSaved: () => void;
  setDocument: (document: BTDocument) => void;
  setActiveTreeId: (treeId: string) => void;
  setFileName: (name: string) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  selectAll: () => void;
  runValidation: () => void;
  closeValidationPanel: () => void;
  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  reorderChildren: (parentId: string, orderedChildIds: string[]) => void;
  connect: (parentId: string, childId: string) => void;
  disconnect: (connectionId: string) => void;
  removeNode: (id: string) => void;
  updateNodeName: (id: string, name: string) => void;
  updateNodeKind: (id: string, kind: BTNode['kind']) => void;
  updateNodeTreeRef: (id: string, treeRef: string) => void;
  renameTree: (treeId: string, newName: string) => void;
  // 在文件中附加一棵新樹（只有一個 Root，沒有連線），並讓它成為使用中的樹。
  // 透過 withSnapshot 把一個 DocSnapshot 推入 undoStack。
  // 名稱由呼叫端決定；TabBar 產生 "Tree N"。
  addTree: (name: string) => void;
  // 從文件中移除一棵樹。拒絕移除主樹（屬於呼叫端的錯誤）與任何不存在的 id。
  // 如果被刪除的樹是使用中的樹，就切換到主樹。
  // 參照被刪除樹名稱的 SubTree 節點會保留過期的 treeRef，由驗證規則 R10
  // （失效的參照）在儲存時提出。透過 withSnapshot 推入一個 DocSnapshot；
  // 被刪除樹的視口刻意保留（不丟棄），讓 undo 能還原它。
  // 需要明確清除時，使用 removeTreeStateFor。
  deleteTree: (treeId: string) => void;
  // 依 orderedIds 重新排列 document.trees（拖曳重新排列分頁）。
  // 防禦性處理：orderedIds 不是目前樹 id 的排列時，記錄訊息並不做任何事。
  // 次序沒有改變時不做任何事，也不建立歷史紀錄（逐元素比較：即使放回原位，
  // DnD 函式庫也會回傳新的陣列）。保留 BTTreeDef 參照。推入一個 DocSnapshot。
  reorderTrees: (orderedIds: string[]) => void;
  deleteSelection: () => void;
  // 複製每個被選取的節點（不含 Root）及它們之間的連線。複製出的節點放在
  // +(GRID_SIZE, GRID_SIZE) 的位置，在原地成為孤立節點。選取切換到複製出的
  // 集合，讓使用者可以立即拖曳、刪除或再次複製。選取為空、只有邊、
  // 或只有 Root 時不做任何事，也不建立歷史快照。
  duplicateSelection: () => void;
  // 把目前選取的節點從使用中的樹移動或複製到 destinationTreeId 指定的樹。
  // Move 保留 id，並從來源樹移除被選取的節點（+ 所有相連的邊）；Copy 重新
  // 產生 id，不更動來源樹。把使用中的分頁切換到目的地，並選取轉移的節點。
  // 每次呼叫只執行一次 withSnapshot，所以一次 Ctrl+Z 就能同時還原兩棵樹、
  // 分頁與選取。假設呼叫端（MoveCopyModal）已完成驗證；沒有任何項目
  // 轉移時不做任何事。
  moveCopyToTree: (destinationTreeId: string, mode: 'move' | 'copy') => void;
  beginGesture: () => void;
  undo: () => void;
  redo: () => void;
  applyLayout: (positions: Map<string, { x: number; y: number }>) => void;
  setViewport: (treeId: string, viewport: Viewport) => void;
  // 移除某個樹 id 的單樹視口。歷史紀錄已不再以樹為單位（v1.7.1），
  // 所以這只會動到 viewportByTreeId。對使用中樹的 id 呼叫它屬於呼叫端的錯誤。
  removeTreeStateFor: (treeId: string) => void;
}

/**
 * 選擇器輔助函式：回傳畫布／屬性面板目前針對的 BTTreeDef。
 * 如果 `activeTreeId` 已不對應任何樹，就丟出錯誤（這代表其他地方有錯誤；
 * 請讓 activeTreeId 與 `document.trees` 保持同步）。
 */
export function selectActiveTree(state: BTStoreState): BTTreeDef {
  const tree = state.document.trees.find((t) => t.id === state.activeTreeId);
  if (!tree) {
    throw new Error(
      `selectActiveTree: activeTreeId ${state.activeTreeId} is not in document.trees`,
    );
  }
  return tree;
}

/**
 * 選擇器輔助函式：回傳某棵樹已儲存的視口；如果這棵樹從未被造訪過，
 * 則回傳預設值（原點，縮放 1）。
 */
export function selectViewport(state: BTStoreState, treeId: string): Viewport {
  return state.viewportByTreeId[treeId] ?? DEFAULT_VIEWPORT;
}

function replaceTree(doc: BTDocument, nextTree: BTTreeDef): BTDocument {
  return {
    ...doc,
    trees: doc.trees.map((t) => (t.id === nextTree.id ? nextTree : t)),
  };
}

function withoutId(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

function withoutIds(
  set: ReadonlySet<string>,
  ids: ReadonlySet<string>,
): ReadonlySet<string> {
  if (set.size === 0 || ids.size === 0) return set;
  let changed = false;
  const next = new Set(set);
  for (const id of ids) {
    if (next.delete(id)) changed = true;
  }
  return changed ? next : set;
}

// 丟棄某個樹 id 的單樹視口。由 removeTreeStateFor 使用。
// v1.7.1 起歷史紀錄已不以 treeId 為鍵，所以沒有其他需要丟棄的資料。
function dropTreeState(
  state: BTStoreState,
  treeId: string,
): Pick<BTStoreState, 'viewportByTreeId'> {
  const { [treeId]: _v, ...viewportByTreeId } = state.viewportByTreeId;
  void _v;
  return { viewportByTreeId };
}

// 把目前的文件 + activeTreeId 推入 undoStack，並清空 redoStack
// （新的推入會讓任何向前的分支失效）。patch 套用在快照推入之上，
// 所以下一個文件狀態由呼叫端負責計算。狀態相同時的提前返回留在呼叫端：
// 它們 `return {}`，不呼叫 withSnapshot。
function withSnapshot(
  state: BTStoreState,
  patch: Partial<BTStoreState>,
): Partial<BTStoreState> {
  return {
    undoStack: push(state.undoStack, {
      document: state.document,
      activeTreeId: state.activeTreeId,
    }),
    redoStack: clear(state.redoStack),
    ...patch,
  };
}

const initialDocument = createEmptyDocument();

export const useBTStore = create<BTStoreState>((set) => ({
  document: initialDocument,
  activeTreeId: initialDocument.mainTreeId,
  selection: EMPTY_SELECTION,
  undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
  redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
  viewportByTreeId: {},
  validationIssues: null,
  fileName: 'Untitled.json',
  exportInProgress: null,
  searchOpen: false,
  searchMatchIds: new Set(),
  searchCurrentId: null,
  dirty: false,
  lastSavedDocument: initialDocument,
  // 不建立歷史快照：純 UI 狀態。
  setExportInProgress: (mode) => set({ exportInProgress: mode }),
  // 不建立歷史快照：暫態的搜尋 UI 狀態。關閉搜尋時清除符合集合
  // 與目前的 id，讓過期的醒目標示永遠不會殘留在畫布上。
  setSearchOpen: (open) =>
    set(
      open
        ? { searchOpen: true }
        : { searchOpen: false, searchMatchIds: new Set(), searchCurrentId: null },
    ),
  setSearchMatchIds: (ids) => set({ searchMatchIds: ids }),
  setSearchCurrentId: (id) => set({ searchCurrentId: id }),
  // 把 dirty 的基準重新設為目前的文件。訂閱在下一次執行時會計算出
  // dirty=false（document === lastSavedDocument）。
  markSaved: () =>
    set((state) => ({ dirty: false, lastSavedDocument: state.document })),
  setDocument: (document) =>
    set({
      document,
      activeTreeId: document.mainTreeId,
      selection: EMPTY_SELECTION,
      undoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
      redoStack: createRingBuffer<DocSnapshot>(HISTORY_CAPACITY),
      viewportByTreeId: {},
      validationIssues: null,
      fileName: 'Untitled.json',
      // 開啟／載入文件就是新的未修改基準。
      dirty: false,
      lastSavedDocument: document,
    }),
  // 純 UI 狀態：不建立歷史快照。切換分頁時清除選取，避免顯示不在
  // 使用中畫布上的節點。視口的還原由 Canvas 驅動（Canvas 持有 xyflow API）。
  // 切換分頁永遠不影響歷史紀錄：歷史紀錄是單一的文件層級時間軸。
  setActiveTreeId: (treeId) =>
    set({ activeTreeId: treeId, selection: EMPTY_SELECTION }),
  setFileName: (name) => set({ fileName: name }),
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: EMPTY_SELECTION }),
  selectAll: () =>
    set((state) => {
      const tree = selectActiveTree(state);
      return {
        selection: {
          nodeIds: new Set(tree.nodes.map((n) => n.id)),
          edgeIds: new Set(tree.connections.map((c) => c.id)),
        },
      };
    }),
  runValidation: () =>
    set((state) => ({ validationIssues: validate(state.document) })),
  closeValidationPanel: () => set({ validationIssues: null }),
  addNode: (kind, position) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = addNode(tree, kind, position);
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  moveNode: (id, position) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = moveNode(tree, id, position);
      if (nextTree === tree) return {};
      return { document: replaceTree(state.document, nextTree) };
    }),
  // 不建立歷史快照：與 beginGesture+moveNode 在同一個手勢中呼叫。
  reorderChildren: (parentId, orderedChildIds) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = reorderChildren(tree, parentId, orderedChildIds);
      if (nextTree === tree) return {};
      return { document: replaceTree(state.document, nextTree) };
    }),
  connect: (parentId, childId) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = connect(tree, parentId, childId);
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  disconnect: (connectionId) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = disconnect(tree, connectionId);
      if (nextTree === tree) return {};
      const nextSelection = {
        nodeIds: state.selection.nodeIds,
        edgeIds: withoutId(state.selection.edgeIds, connectionId),
      };
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
        selection: nextSelection,
      });
    }),
  removeNode: (id) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = removeNode(tree, id);
      if (nextTree === tree) return {};
      const removedEdgeIds = new Set(
        tree.connections
          .filter((c) => c.parentId === id || c.childId === id)
          .map((c) => c.id),
      );
      const nextSelection: Selection = {
        nodeIds: withoutId(state.selection.nodeIds, id),
        edgeIds: withoutIds(state.selection.edgeIds, removedEdgeIds),
      };
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
        selection: nextSelection,
      });
    }),
  updateNodeKind: (id, kind) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = updateNode(tree, id, { kind });
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  // 選擇 treeRef 時，也把節點名稱同步為被參照樹的名稱。SubTree 節點的身分
  // *就是*它展開的那棵樹，所以我們在每個變更點都讓這兩個欄位保持同步
  // （這裡處理選擇；下方的 renameTree 處理樹的改名）。在這條規則出現之前
  // 建立、name != treeRef 的舊資料會照原樣顯示，直到使用者碰觸下拉選單或
  // 名稱欄位為止；載入時不會默默改寫。
  updateNodeTreeRef: (id, treeRef) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const referenced = state.document.trees.find((t) => t.name === treeRef);
      const patch = referenced
        ? { treeRef, name: referenced.name }
        : { treeRef };
      const nextTree = updateNode(tree, id, patch);
      if (nextTree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
      });
    }),
  // 不建立歷史快照：屬性面板把一次焦點工作階段包在 beginGesture() 中，
  // 讓多個字元的改名合併成一個 undo 步驟。
  updateNodeName: (id, name) =>
    set((state) => {
      const tree = selectActiveTree(state);
      const nextTree = updateNode(tree, id, { name });
      if (nextTree === tree) return {};
      return { document: replaceTree(state.document, nextTree) };
    }),
  // 以單一歷史步驟刪除每個被選取的節點（Root 除外）與每條被選取的邊。
  // 與被刪除節點相連的邊由 removeNode 移除，
  // 所以我們只需要中斷那些被單獨選取的邊。
  deleteSelection: () =>
    set((state) => {
      if (isEmptySelection(state.selection)) return {};
      const tree = selectActiveTree(state);
      let nextTree: BTTreeDef = tree;
      for (const nodeId of state.selection.nodeIds) {
        if (nodeId === tree.rootId) continue;
        nextTree = removeNode(nextTree, nodeId);
      }
      const survivingEdgeIds = new Set(nextTree.connections.map((c) => c.id));
      for (const edgeId of state.selection.edgeIds) {
        if (!survivingEdgeIds.has(edgeId)) continue;
        nextTree = disconnect(nextTree, edgeId);
      }
      if (nextTree === tree) return { selection: EMPTY_SELECTION };
      return withSnapshot(state, {
        document: replaceTree(state.document, nextTree),
        selection: EMPTY_SELECTION,
      });
    }),
  duplicateSelection: () =>
    set((state) => {
      const tree = selectActiveTree(state);
      const result = duplicateSelection(tree, state.selection.nodeIds, {
        offsetX: GRID_SIZE,
        offsetY: GRID_SIZE,
      });
      // 回傳相同參照 = 沒有複製任何項目（選取為空／只有邊／只有 Root）。
      // 略過快照推入，避免只選了邊時，一次沒有效果的複製把使用者的選取清掉。
      if (result.tree === tree) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, result.tree),
        selection: { nodeIds: result.newNodeIds, edgeIds: result.newEdgeIds },
      });
    }),
  moveCopyToTree: (destinationTreeId, mode) =>
    set((state) => {
      // 防禦性處理：對話框只列出非使用中的樹，但仍要防範目標是自己或 id 不存在
      // 的情況，而不是讓文件損毀。
      if (destinationTreeId === state.activeTreeId) return {};
      const sourceTree = selectActiveTree(state);
      const destTree = state.document.trees.find((t) => t.id === destinationTreeId);
      if (!destTree) return {};

      const result = moveCopySelection({
        sourceTree,
        destTree,
        selectedNodeIds: state.selection.nodeIds,
        mode,
      });
      // 篩選後沒有任何項目（選取為空／只有邊）：略過快照，
      // 避免一次沒有效果的呼叫污染歷史紀錄或清除分頁。
      if (result.transferredNodeIds.length === 0) return {};

      // 兩次 replaceTree 呼叫把（可能沒有變更的）來源樹與目的地樹
      // 合併成一份新文件，由單一的 withSnapshot 記錄。
      const document = replaceTree(
        replaceTree(state.document, result.sourceTree),
        result.destTree,
      );
      return withSnapshot(state, {
        document,
        activeTreeId: destinationTreeId,
        selection: { nodeIds: new Set(result.transferredNodeIds), edgeIds: new Set() },
      });
    }),
  // 推入目前狀態的快照，但不改變狀態。由 Canvas（拖曳開始）與
  // PropertyPanel（開始編輯名稱）使用，把一個手勢中的一連串更新
  // 合併成單一 undo 步驟。
  beginGesture: () => set((state) => withSnapshot(state, {})),
  // 從 undoStack 彈出最近的快照、還原文件，並把還原前的狀態推入 redoStack。
  // activeTreeId 保持不變，除非目前顯示的樹在還原後的文件中已不存在；
  // 這種情況下（例如在新分頁中復原 addTree），改用快照中的 activeTreeId。
  // 選取會被清除。
  undo: () =>
    set((state) => {
      const top = peek(state.undoStack);
      if (!top) return {};
      const { buf } = pop(state.undoStack);
      const stillExists = top.document.trees.some(
        (t) => t.id === state.activeTreeId,
      );
      return {
        document: top.document,
        activeTreeId: stillExists ? state.activeTreeId : top.activeTreeId,
        undoStack: buf,
        redoStack: push(state.redoStack, {
          document: state.document,
          activeTreeId: state.activeTreeId,
        }),
        selection: EMPTY_SELECTION,
      };
    }),
  // Redo 與 undo 對稱：彈出 redoStack、還原，並把還原前的狀態推入 undoStack。
  // 使用相同的使用中分頁後備規則。
  redo: () =>
    set((state) => {
      const top = peek(state.redoStack);
      if (!top) return {};
      const { buf } = pop(state.redoStack);
      const stillExists = top.document.trees.some(
        (t) => t.id === state.activeTreeId,
      );
      return {
        document: top.document,
        activeTreeId: stillExists ? state.activeTreeId : top.activeTreeId,
        redoStack: buf,
        undoStack: push(state.undoStack, {
          document: state.document,
          activeTreeId: state.activeTreeId,
        }),
        selection: EMPTY_SELECTION,
      };
    }),
  // 為一棵樹改名，並把新名稱傳播到 treeRef 指向舊名稱的每個 SubTree 節點。
  // 跨樹變更：也更新這些 SubTree 的 node.name，維持名稱同步的不變條件。
  // 新名稱與舊名稱相同時不做任何事。不做任何驗證：名稱唯一性在儲存時由
  // btDocumentSchemaV2 強制執行（符合程式碼庫「驗證但不阻擋」的模式）。
  // 透過 withSnapshot 推入一個 DocSnapshot。
  renameTree: (treeId, newName) =>
    set((state) => {
      const tree = state.document.trees.find((t) => t.id === treeId);
      if (!tree || tree.name === newName) return {};
      const oldName = tree.name;
      const trees = state.document.trees.map((t) => {
        const renamedTree = t.id === treeId ? { ...t, name: newName } : t;
        let touchedAnyNode = false;
        const nextNodes = renamedTree.nodes.map((n) => {
          if (n.kind !== 'SubTree' || n.treeRef !== oldName) return n;
          touchedAnyNode = true;
          return { ...n, treeRef: newName, name: newName };
        });
        return touchedAnyNode ? { ...renamedTree, nodes: nextNodes } : renamedTree;
      });
      return withSnapshot(state, {
        document: { ...state.document, trees },
      });
    }),
  addTree: (name) =>
    set((state) => {
      const treeId = crypto.randomUUID();
      const rootId = crypto.randomUUID();
      const root: BTNode = {
        id: rootId,
        kind: 'Root',
        name: 'Root',
        position: { x: 0, y: 0 },
        properties: {},
      };
      const newTree: BTTreeDef = {
        id: treeId,
        name,
        rootId,
        nodes: [root],
        connections: [],
      };
      return withSnapshot(state, {
        document: { ...state.document, trees: [...state.document.trees, newTree] },
        activeTreeId: treeId,
        selection: EMPTY_SELECTION,
      });
    }),
  deleteTree: (treeId) =>
    set((state) => {
      if (treeId === state.document.mainTreeId) return {};
      if (!state.document.trees.some((t) => t.id === treeId)) return {};
      const nextTrees = state.document.trees.filter((t) => t.id !== treeId);
      const wasActive = state.activeTreeId === treeId;
      // 被刪除樹的單樹視口刻意*不*在這裡丟棄，讓 undo 能完整還原它。
      // 不需要可復原性而要明確清除時，使用 removeTreeStateFor。
      return withSnapshot(state, {
        document: { ...state.document, trees: nextTrees },
        activeTreeId: wasActive ? state.document.mainTreeId : state.activeTreeId,
        selection: wasActive ? EMPTY_SELECTION : state.selection,
      });
    }),
  reorderTrees: (orderedIds) =>
    set((state) => {
      const current = state.document.trees;
      const byId = new Map(current.map((t) => [t.id, t]));
      if (
        orderedIds.length !== current.length ||
        !orderedIds.every((id) => byId.has(id))
      ) {
        console.warn(
          'reorderTrees: orderedIds is not a permutation of current tree ids; ignoring',
          { orderedIds, current: current.map((t) => t.id) },
        );
        return {};
      }
      if (orderedIds.every((id, i) => id === current[i]!.id)) return {};
      const nextTrees = orderedIds.map((id) => byId.get(id)!);
      return withSnapshot(state, {
        document: { ...state.document, trees: nextTrees },
      });
    }),
  applyLayout: (positions) =>
    set((state) => {
      const tree = selectActiveTree(state);
      let changed = false;
      const nextNodes = tree.nodes.map((n) => {
        const p = positions.get(n.id);
        if (!p || (p.x === n.position.x && p.y === n.position.y)) return n;
        changed = true;
        return { ...n, position: p };
      });
      if (!changed) return {};
      return withSnapshot(state, {
        document: replaceTree(state.document, { ...tree, nodes: nextNodes }),
      });
    }),
  setViewport: (treeId, viewport) =>
    set((state) => ({
      viewportByTreeId: { ...state.viewportByTreeId, [treeId]: viewport },
    })),
  removeTreeStateFor: (treeId) =>
    set((state) => dropTreeState(state, treeId)),
}));

// FR9 dirty 追蹤。單一的 store 層級訂閱以參照相等來推導 `dirty`：每個
// 會變更的 action 都建立新的 `document` 物件，而沒有實際變更的 action
// 回傳 `{}`（保留參照），所以比較結果永遠不會誤判。setDocument／markSaved
// 讓 lastSavedDocument 重新指向目前的文件，使這裡計算出 dirty=false。
// 防護條件（`shouldBeDirty !== state.dirty`）讓 dirty 的寫入不會重複進入：
// 巢狀的 setState 會再次觸發訂閱者，但值已經相符，所以會停止。
// 放在 store 層級（而不是 hook），讓 dirty 不論是否有元件掛載都保持正確，
// 見 SPEC-v1.11 FR9／已決議決策 #8。
useBTStore.subscribe((state) => {
  const shouldBeDirty = state.document !== state.lastSavedDocument;
  if (shouldBeDirty !== state.dirty) {
    useBTStore.setState({ dirty: shouldBeDirty });
  }
});
