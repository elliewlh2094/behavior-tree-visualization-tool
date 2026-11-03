# ADR 007 — 以暫態 store 欄位 `searchCurrentId` 標示目前符合項（FR6）

**日期：** 2026-06-23
**狀態：** 已接受

## 背景

`docs/SPEC-v1.11.md` 的 FR6（節點搜尋）列出搜尋狀態在 store 中只有兩個暫態欄位：`searchOpen` 與 `searchMatchIds`，並說明「Canvas 把 `isSearchMatch` 注入節點資料」。對應的 `docs/tasks/v1.11-todo.md` T9 另外要求**兩種**不同的醒目標示：每個符合項都有「搜尋符合」外框，使用者目前停留的那一個符合項另有更明顯的「目前符合項」標示。T9 也要求把目前符合項置中。

這兩份文件互相矛盾。`searchMatchIds` 是 `ReadonlySet<string>`。選擇 `Set` 的原因是讓 `BTNode` 能以 O(1) 的 `has(id)` 判斷節點是否要顯示符合外框。但 `Set` 沒有次序：它能回答「這個節點是不是符合項？」，卻無法回答「N 個符合項中，哪一個是目前的？」。目前符合項的標示需要後者。

資料流的限制讓問題更明確。節點的醒目標示由 `BTNode` 繪製。`BTNode` 的 props 來自 `node.data`，`node.data` 由 `Canvas` 組合，而 `Canvas` 只讀取 **store**。但*目前索引*屬於 `SearchBox`（使用者按 Enter／↑／↓ 時，由這個輸入元件推進索引）。`SearchBox` 與 `Canvas` 是同層元件，兩者之間唯一的溝通管道是 store。選取狀態（`selection.nodeIds`）與圖片匯出模式（`exportInProgress`）也是走同一條路徑。

因此，如果只有規格中的兩個欄位，目前符合項**只能**靠鏡頭置中來表示，沒有獨立的外框。當數個符合項在畫面上聚集時，單靠置中無法判斷哪一個醒目節點是「2/5」。

## 決策

在 `searchOpen` 與 `searchMatchIds` 之外，新增第三個暫態 store 欄位 **`searchCurrentId: string | null`**。

- `searchMatchIds` 維持單一職責：*成員判斷*（「這個節點是不是符合項？」），供符合外框使用，在 `BTNode` 中為 O(1)。
- `searchCurrentId` 回答另一個獨立的問題：*游標*（「這個節點是不是目前的符合項？」），供更明顯的外框與置中目標使用。
- `SearchBox` 在本地持有有序的符合清單與目前索引，並把 `searchMatchIds` 與 `searchCurrentId` 都寫入 store。`Canvas` 根據這兩個欄位，把 `isSearchMatch` **與** `isCurrentMatch` 注入 `node.data`。

這個欄位與另外兩個欄位一樣是完全暫態的：它使用一般的 setter，不經過 `withSnapshot`，不屬於 `DocSnapshot`，不推入歷史紀錄。搜尋關閉時（`setSearchOpen(false)`），它與 `searchMatchIds` 一起被清除。

這是對 SPEC FR6 兩欄位清單的記錄在案的偏離。差異只在**數量**（3 個欄位而非 2 個），沒有改變行為或架構。這項偏離記錄在 `v1.11-todo.md` T9 的偏離區塊與本 ADR 中。

## 考慮過的替代方案

| 方案 | 不採用的原因 |
|---|---|
| **嚴格遵守規格：只置中，沒有獨立的目前符合外框** | 字面上符合 SPEC FR6 的驗收條件，但不符合 todo T9 的「目前符合項標示」要求，使用體驗也較差：只有鏡頭移動時，聚集的符合項無法分辨。 |
| **在 store 中以有序的符合陣列加索引取代 `Set`** | 讓 `searchMatchIds` 負擔兩項職責（成員判斷**與**次序），而且 `BTNode` 會失去 O(1) 的成員判斷（每個節點都要掃描陣列或呼叫 `indexOf`）。兩個獨立的問題用兩個欄位表達較清楚。 |
| **從 `SearchBox` 以 prop 逐層傳遞或 React context 傳到 `BTNode`** | `SearchBox` 不負責 `Canvas` 的節點組合。把目前索引往上傳到 `Canvas`（或新增 context provider）需要的串接比一個暫態欄位多，而且會打破選取狀態與匯出模式已採用的 store → Canvas → `node.data` 資料流。 |
| **在 `Canvas`／`BTNode` 中推導「目前」** | 無法推導。「目前」是導航狀態（使用者跳到哪一個符合項），不是文件或查詢字串的函數，所以必須儲存。 |

## 影響

- **規格與實作不一致。** SPEC-v1.11 FR6 括號內的檔案清單（`transient searchOpen, searchMatchIds`）現在不完整。應更新該清單並加入 `searchCurrentId`，讓規格與程式碼不再分歧（做法比照 Checkpoint A 之後 FR3 修訂規格的方式）。
- **對歷史紀錄與 PWA 沒有影響。** 這個欄位是暫態的，不經過 `withSnapshot`，所以 SPEC 真正的硬性限制「搜尋狀態是暫態的，不進入 undo/redo 歷史紀錄」完全保留。這項偏離不涉及 `DocSnapshot`、序列化或 service worker。
- **醒目標示的組合。** `BTNode` 把依節點類型著色的選取外框（內圈）與品牌／標誌綠色的搜尋外框（外圈；目前符合項另加柔和光暈）組合成單一 `boxShadow`，並在圖片匯出時隱藏兩者。同時被選取且是目前符合項的節點會顯示兩圈外框，兩者不會互相遮蓋。
- **effect 相依的陷阱（提醒維護者）。** `SearchBox` 的「重設到第一個」effect 只以 `[matches]` 為相依（並使用 `eslint-disable react-hooks/exhaustive-deps`，與 Toolbar 的慣用寫法相同）。`goToIndex` 閉包包住 xyflow 的 `getZoom`，所以每次渲染身分都會改變。如果把它列入相依，effect 會在每次渲染時重新執行，並在使用者按下一個／上一個時把索引重設。導航一律以命令式呼叫 `goToIndex`，不透過這個 effect。
- **容易撤回。** 如果日後的變更移動了搜尋的擁有者（例如由命令面板負責導航），`searchCurrentId` 只是一個要移除的暫態欄位，不需要遷移，也沒有持久化資料。
