# ADR 010 — 離開編輯器時的未存變更守衛（data router + useBlocker）

**日期：** 2026-06-27
**狀態：** 已接受

## 背景

FR9（v1.11）新增未存變更追蹤，包括三個部分：

- 由 store 推導的 `dirty` 旗標。
- 標題上的 `● ` 指示符號。
- `useBeforeUnload(dirty)`：一個 `beforeunload` 監聽器。關閉分頁或重新整理時，它會觸發瀏覽器原生的「要離開網站嗎？」對話框。

Checkpoint B 的測試發現一個缺口。`beforeunload` 只在**文件卸載**（關閉分頁、重新載入）時觸發，在應用程式內的 SPA 導航時**不會**觸發。最重要的情況是：使用者按瀏覽器的**上一頁**按鈕，從 `#/editor` 回到登陸頁 `#/`。這是一次 hash 變更，完全由 React Router 處理，沒有發生卸載。因此，使用者編輯樹之後按上一頁，修改會在沒有任何提示的情況下遺失。

先前的一次嘗試改為守衛*登陸頁*的進入動作（「Go to Editor」重設、範本卡片），使用 `window.confirm`。這個介入點是錯的：它把「回到登陸頁」視為安全，並把提示延後到下一次覆蓋。使用者的需求是：**離開編輯器畫布本身**（無論是上一頁、關閉或重新整理）必須提示「留下／離開」，而且可以取消。這與原生對話框在關閉／重新整理時提供的心智模型相同。

要攔截並*取消*應用程式內的導航，需要導航阻擋器。React Router 的 `useBlocker` 正好提供這項功能，但只能在 **data router**（`createHashRouter` + `RouterProvider`）中使用。應用程式原本使用 `<HashRouter>` 元件，而這個元件不支援 `useBlocker`。

## 決策

1. **把路由從 `<HashRouter>` 元件遷移到 data router。** 在 `App.tsx` 中改用 `createHashRouter([...])` + `<RouterProvider>`。網址、以 hash 為基礎的策略（AD7）、依路由劃分的主題（AD8）與 PWA 都不變；這項遷移只是解鎖 data router 的 API。

2. **以 `useBlocker` 阻擋從 dirty 編輯器離開的應用程式內導航。** `EditorRoute` 呼叫 `useBlocker(dirty)`。當 `blocker.state === 'blocked'` 時，它渲染自訂的 `UnsavedChangesModal`（符合應用程式 `--bt-*` 對話框樣式）：
   - **Stay on page** → `blocker.reset()`。
   - **Leave page** → `blocker.proceed()`。

   「Stay」是安全的預設選項（自動取得焦點；Esc 與點擊背景也對應到它）。按鈕文字與原生 `beforeunload` 的按鈕一致，讓兩條路徑的用語相同。

3. **保留 `useBeforeUnload(dirty)` 處理硬性離開。** 關閉分頁／重新整理仍使用瀏覽器原生（無法自訂）的對話框；只有應用程式內的 POP 導航使用自訂對話框。兩者互補而非重複，因為它們涵蓋互不重疊的離開方式。

4. **移除登陸頁的 `confirmDiscardIfDirty` 守衛。** 從 dirty 編輯器到登陸頁的唯一路徑是一次導航，而阻擋器已經攔截這次導航。在登陸頁再提示一次會重複詢問。「Go to Editor」保留無條件重設為空白的 `Untitled.json`；範本卡片直接載入。

5. **守衛剩下的唯一原地覆蓋動作：Toolbar 的「Open」。** 開啟檔案會在不導航的情況下取代文件，所以阻擋器與 `beforeunload` 都攔截不到。
   - **修訂（把所有應用程式可控制的捨棄統一到同一個對話框）：** Open 現在與導航阻擋器使用**同一個自訂 `UnsavedChangesModal`**，而不是 `window.confirm`。對話框被一般化為一個展示型確認元件，接收文案 props（`DiscardCopy`：title／message／confirmLabel／cancelLabel），讓每個情境的文字都自然：導航顯示「Stay on page／Leave page」，Open 顯示「Cancel／Discard & open」，但兩者共用同一個視覺外殼。實作分工如下：
     - `useDiscardGuard` hook 保存命令式的待處理動作狀態。
     - EditorRoute 透過 `UnsavedGuardContext` 提供 `requestDiscard(action, copy)`。
     - Toolbar 以 `requestDiscard` 包住兩個 Open 進入點（按鈕與 Ctrl/Cmd+O）。
     - `useFileOpen.triggerOpen()` 現在不含守衛邏輯（只負責開啟檔案選擇器）。
   - **統一的範圍：** 只有*透過 `setDocument` 取代整份文件*的動作才受守衛保護。在編輯器內，這只有 Open（Go to Editor 與範本從登陸頁執行，已由上游的導航阻擋器保護）。**New Tree（`addTree`）與刪除樹（`deleteTree`）刻意不加守衛**：它們只是在同一份文件內新增或移除分頁，而且可以 undo，屬於一般編輯，不是捨棄文件（刪除樹保留自己的刪除確認）。`requestDiscard` 機制可重用於日後任何取代文件的動作。

## 考慮過的替代方案

| 方案 | 不採用的原因 |
|---|---|
| **保留 `<HashRouter>`，手動攔截 `popstate`** | 等於重新實作 `useBlocker`（取消時重新推入歷史紀錄、追蹤待處理的位置），還要處理 hash router 的邊界情況。`useBlocker` 是官方支援的基本元件；遷移到 data router 的改動很小，而且只集中在 `App.tsx`。 |
| **改為守衛登陸頁的進入動作（先前的做法）** | 介入點錯誤：使用者先離開畫布，只在下一次覆蓋時才被提示，所以按「上一頁」本身從不警告。這與「離開畫布才是要守衛的事」的需求相反。 |
| **關閉／重新整理也使用同一個自訂對話框** | 不可能做到。`beforeunload` 無法顯示自訂 UI，也無法執行非同步作業；瀏覽器強制使用自己的對話框。「卸載用原生、應用程式內導航用自訂」的劃分是固有的限制。 |
| **Open 維持使用原生 `window.confirm`** | 與自訂的導航對話框不一致。統一之後，每個應用程式可控制的捨棄都使用同一個有主題的 UI。命令式與宣告式之間的落差，由小型的 `useDiscardGuard` 加 `requestDiscard` context（約一個 hook 加一個 context）銜接。唯一的成本是文案參數化，而這也讓每個提示的文字更自然。 |
| **New Tree／刪除樹也加守衛** | 這兩個動作不會捨棄文件。它們是同一份文件內的新增／移除編輯，而且完全可以 undo。在這裡提示「你會失去未存變更」在語意上是錯的，也會為一般編輯增加阻力。 |

## 影響

- **兩個守衛，涵蓋範圍互不重疊：** `beforeunload`（關閉／重新整理，原生對話框）與 `useBlocker`（應用程式內導航，自訂的留下／離開對話框）。兩者都以同一個 store `dirty` 為依據，所以未修改的文件在任何地方都不會增加阻力。
- **「Stay」不具破壞性且可靠：** React Router 會還原被阻擋的 POP，畫布與編輯內容不受影響；「Leave」則繼續原本的導航。
- **登陸頁不含守衛**，避免重複提示；「Go to Editor」仍一律開啟空白的 `Untitled.json`。
- **每個應用程式可控制的捨棄都共用一個自訂對話框**：應用程式內導航（阻擋器）與 Open（`requestDiscard`），並依情境使用不同文案；只有瀏覽器的關閉／重新整理維持原生。Open 覆蓋是早在這次變更之前就存在的資料遺失路徑，現在已補上，視覺上也一致。
- **路由現在是 data router。** 日後的路由功能應使用 data router 的 API（loaders／actions／`useBlocker`）；`<Routes>/<Route>` 元件形式已不再使用。
- **`*` 後備路由**維持 `<Navigate to="/" replace />` 元素，在 data router 下不需修改即可運作。
