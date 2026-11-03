# Roadmap：Behavior Tree Visualization Tool

> 計畫索引：進行中的版本、捨棄與延後的功能，以及關鍵架構決策（AD 表）。
> 用語：FR（Functional Requirement）＝功能需求；AD（Architectural Decision）＝架構決策；T＝任務編號。

## v1.11「Web Presence & Discoverability」

> 完整規格：`docs/SPEC-v1.11.md`。任務拆解：`docs/tasks/v1.11-todo.md`。路由／部署決策：`docs/adr/006-routing-and-web-deployment.md`。
> 2026-06-22 新增，來源是使用者一次提出的 4 個想法（「讓專案更容易使用」），以 jsoncrack.com 為參考模型。
> **狀態：實作完成，等待人工簽核。** 範圍內的 13 項任務全部完成（T11 小地圖移出範圍，AD9）。
>
> Commits：`ce96035`（規格／roadmap／todo／ADR）、`8674190`（T1–T3 base、靜態資源、Pages 部署）、`ceab9f1`（T4–T5 HashRouter 與 LandingPage；StartScreen 移除）、`b2798d7`（T6–T7 dirty 標記與 beforeunload）、`80901f1`（T8–T10 搜尋）、`1c50303`（主題預設值）、`bb009e0`（T11 小地圖，之後撤回）、`d865397`（FR7 移出範圍，AD9）、`787a84a`（畫布控制項重繪修正）、`32d06a3`（T12–T13 範本，以及 T7b–T7c 統一未存變更守衛，AD10）。
>
> 最終檢查（HEAD `32d06a3`）：typecheck 通過；lint 0 個錯誤；**490 個單元測試**（44 個檔案）與 **62 個 e2e 測試**全部通過；build 通過（預先快取 11 個項目，635.45 KiB）。剩餘項目：T14 文件，以及 `docs/tasks/v1.11-todo.md` 中由使用者執行的人工冒煙測試、Lighthouse 與簽核。

**目標：** 降低第一次使用的門檻。讓使用者能在瀏覽器中透過公開網址開啟本工具，並提供精緻的登陸頁（以 jsoncrack.com 為模型）；本機 clone 保留為次要途徑。此外，加入四項編輯器內的易用性改善。這四項改善來自對開源工具的調查（jsoncrack、Excalidraw、tldraw、React Flow、Rete.js、Groot2），並排除了應用程式已出貨的功能（自動排版、undo/redo、圖片匯出、暗色主題、驗證、多樹）。

分為兩個階段。**Phase A — Web Distribution（網頁發佈）**先完成。其中的 A0 子步驟（靜態資源路徑與 `base`）是風險最高的項目，因為子路徑 `base` 會讓所有絕對路徑的 `/asset` 參照在沒有錯誤訊息的情況下失效（因此最先處理，及早發現問題）。

### Phase A — Web Distribution（網頁發佈）

- **FR3 — 登陸頁與路由。** 新的 `LandingPage` 位於 `#/`（主視覺、CTA 按鈕、功能重點、截圖）；編輯器移到 `#/editor`。採用 `react-router-dom`（在 T7b 遷移到 **data router** `createHashRouter`／`RouterProvider`，以使用 `useBlocker`，見 AD7／AD10）。**修訂：** 舊的 `StartScreen` 已**移除**。`#/editor` 直接進入畫布（store 預先建立只有一個 Root 的文件），既有檔案由 Toolbar 的「Open」開啟。
- **FR5 — GitHub Pages 部署。** 推送到 `main` 時，透過 GitHub Actions 自動部署。`vite.config.ts` 的 `base` 在 build 時為 `/behavior-tree-visualization-tool/`，在 dev 時為 `/`。絕對路徑的靜態資源改用 `import.meta.env.BASE_URL`。PWA 的 `start_url`／`scope` 維持 `'.'`。README 開頭放上線上網址。

### Phase B — In-Editor Usability（編輯器內易用性）

- **FR6 — 節點搜尋（Ctrl+F）。** 浮動搜尋列（jsoncrack 模型）：
  - 在使用中的樹上，以不分大小寫的方式比對節點名稱。
  - 以琥珀色外框醒目標示符合項（與選取狀態的外觀不同）。
  - 顯示 `n/m` 計數。
  - Enter／↓ 跳到下一個，Shift+Enter／↑ 跳到上一個，每次都以 `setCenter(..., { zoom: getZoom() })` 置中。
  - Esc 關閉。
  - 搜尋狀態是暫態的，不進入歷史紀錄。跨樹搜尋不在範圍內。
- ~~**FR7 — 小地圖。**~~ **2026-06-25 延後**（AD9）。已建置並驗證（commit `bb009e0`），然後在出貨前移除。原因：xyflow 內建的 `<MiniMap>` 只顯示色塊（沒有標籤與連線），對行為樹傳達的資訊很少，而且與 FR6 搜尋重疊。實作保留在 git 歷史中；有使用者需求，或有能繪製標籤與連線的自製小地圖時，再重新評估。見 `docs/adr/009`。
- **FR8 — 範例範本。** 以 v2 schema 序列化的樹存放在 `src/templates/*.ts`，透過既有的 `deserialize → setDocument` 路徑載入；登陸頁上有「Or start from a template」入口。**修訂：** 只出貨 **Chase**。Chase 以 `SubTree` 的形式內含 **Patrol** 樹，所以獨立的 Patrol 卡片是多餘的，因此移除。
- **FR9 — 未存變更守衛。** 新的 `dirty` 旗標，以 `document` 參照與 `lastSavedDocument` 比較來追蹤。這種做法涵蓋不經過 `withSnapshot` 的變更；沒有實際變更的操作會保留原參照，所以不會誤判。dirty 旗標驅動標題與檔名上的 `●` 標記。**修訂（AD10）：** 守衛的介入點從「下一次覆蓋」移到**離開編輯器畫布**。應用程式內的導航由 `useBlocker` 阻擋，每個應用程式可控制的捨棄（上一頁、Open）都共用同一個自訂 `UnsavedChangesModal`；只有關閉分頁／重新整理維持使用原生的 `beforeunload` 提示。`markSaved()`（儲存）與 `setDocument`（開啟／載入範本）會清除 dirty 旗標。

**不在範圍內（v1.11）：** 跨樹搜尋；BrowserRouter／乾淨的網址；命令面板與右鍵選單（已調查，使用者決定延後）；自動儲存／以 localStorage 保存文件；自訂網域；行為樹格式互通（FR4 維持延後）。

**估計範圍：** M–L，共 14 項任務。
- Phase A0 關鍵路徑：T1→T2→T3（部署基礎）。
- Phase A：T4→T5（路由與登陸頁）。
- Phase B 可平行進行：{T6→T7} dirty、{T8→T9→T10} 搜尋、T11 小地圖、{T12→T13} 範本。
- 最後是 T14 文件與出貨。

**相依性：** v1.10 已完成（Toolbar／TabBar／Canvas 的版面已定案）。FR8 的 UI 入口相依於 FR3 的路由與登陸頁；FR9 獨立。

---

## 捨棄的功能（Dropped）

### F17 — 可重用的節點範本（2026-05-11 捨棄）

原本的目標版本是 v2.0。v1.4 的 SubTree 參照（F13）出貨後，使用者決定捨棄這項功能。理由如下：
- 「改一次、所有地方生效」的情境已由 SubTree 參照滿足。
- 「複製後各自修改」的情境已由 v1.5 的複製功能與（規劃中的）v1.10 Copy 滿足。
- 因此，相對於成本，全新的範本登錄抽象層已不再有吸引力。

**AD5 已撤銷**：它不再是 roadmap 上的關鍵決策。

---

## 延後（Deferred，未排程）

### FR4 — 與外部行為樹格式互通

2026-05-11 使用者提出。匯入／匯出 BehaviorTree.CPP XML、Groot 等格式。每一種格式本身都是一份份量不小的規格。目前沒有迫切的使用者需求；需求增加時再重新評估。

### FR7 — 小地圖（2026-06-25 延後）

在 v1.11 中已建置並驗證（commit `bb009e0`），然後在出貨前移除（AD9，`docs/adr/009`）。xyflow 內建的 `<MiniMap>` 只繪製色塊，沒有標籤與連線，所以對由上而下的行為樹傳達的資訊很少；而它可能滿足的「找到節點」需求，已由 FR6 搜尋涵蓋。重新評估的觸發條件：實際使用者回饋大型樹難以導航，或出現能繪製標籤與連線的自製小地圖節點元件。可運作的實作可以從 git 歷史中恢復。

---

## 關鍵架構決策（AD 表）

| ID | 決策 | 版本 | 理由 |
|----|----------|---------|-----------|
| AD1 | 偏好設定放在獨立的 Zustand store，並使用 `persist` middleware | v1.3 | 生命週期與樹資料不同：需要持久保存、不參與 undo/redo、樹變更時仍保留 |
| AD2 | 所有可套用主題的色彩都使用 CSS 自訂屬性 | v1.3 | 執行期可變更且不需重新渲染；支援暗色模式切換 |
| AD3 | 自製遞迴樹排版，不使用 dagre／elkjs | v1.2 | 行為樹是嚴格的階層結構；約 100 行程式碼，相較於 8–130KB 的相依套件 |
| AD4 | `BehaviorTree` → `BTDocument` 模型，檔案格式 v2 | v1.4 | 支援子樹參照與多樹文件 |
| ~~AD5~~ | ~~可重用的節點範本延後到 v2.0~~ — **2026-05-11 撤銷** | — | F17 已從 roadmap 捨棄；SubTree 參照與 Copy 已涵蓋使用情境 |
| AD6 | 統一時間軸的 undo/redo（單一依時間排序的 `RingBuffer<DocSnapshot>`）；分頁只是 UI 投影 | v1.7.1 | 取代 v1.7 的「每棵樹 + 全域」雙堆疊模型。冒煙測試發現該模型有 UI 跳轉、max-seq 合併缺口與過期快照等問題 |
| AD7 | HashRouter 路由與 GitHub Pages 子路徑部署（`base` 只在 build 時生效）；靜態資源透過 `import.meta.env.BASE_URL` 參照 | v1.11 | Pages 專案網站對 BrowserRouter 的深層連結回傳 404，並部署在子路徑下；hash 不會產生 404，PWA service worker 也看不到它。完整理由見 `docs/adr/006`。 |
| AD8 | 依路由劃分主題擁有者：登陸頁跟隨作業系統（`prefers-color-scheme`，無控制項）；編輯器由使用者控制，預設 `system` | v1.11 | FR6 冒煙測試回饋：登陸頁應跟隨訪客的作業系統，而不是儲存的編輯器偏好。各路由的 effect 擁有 `.dark` class；FOUC 腳本能感知路由。完整理由見 `docs/adr/008`。 |
| AD9 | 小地圖（FR7）移出 v1.11 範圍；實作保留在 git 歷史（commit `bb009e0`），不以死碼或註解掉的程式碼留存 | v1.11 | 內建的 `<MiniMap>` 只顯示色塊（沒有標籤與連線），對由上而下的行為樹價值很低，而且與 FR6 搜尋重疊。有使用者需求，或有能繪製標籤與連線的自製小地圖時，再重新評估。完整理由見 `docs/adr/009`。 |
| AD10 | 未存變更守衛統一使用一個自訂對話框，處理每個**應用程式可控制的捨棄**：遷移到 data router（`createHashRouter`／`RouterProvider`）並以 `useBlocker` 處理應用程式內導航（上一頁）；`requestDiscard` context 與 `useDiscardGuard` 讓 Open 使用**同一個**對話框（文案參數化）；`beforeunload` 繼續處理關閉／重新整理（原生，唯一無法統一的情況）；New Tree／刪除樹刻意不加守衛（可 undo，不捨棄文件）；移除登陸頁的守衛 | v1.11 | Checkpoint B 回饋：`beforeunload` 攔不到 SPA 的上一頁；守衛應該放在「離開畫布／取代文件」的位置。所有應用程式內的捨棄都使用同一個有主題的對話框。完整理由見 `docs/adr/010`。 |
