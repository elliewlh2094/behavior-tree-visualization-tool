# 規格：Behavior Tree Visualization Tool — v1.11「Web Presence & Discoverability」

> Roadmap 條目：`docs/tasks/roadmap.md` §v1.11。任務拆解：`docs/tasks/v1.11-todo.md`。路由／部署決策：`docs/adr/006-routing-and-web-deployment.md`。
> 2026-06-22 新增，來源是使用者一次提出的 4 個想法（「讓專案更容易使用」），以 jsoncrack.com 為參考模型。
> 狀態：**實作完成，等待人工簽核。** 範圍內的 FR（Functional Requirement，功能需求）全部完成（FR7 小地圖移出範圍，AD9）；commit 清單與最終測試數量見 `docs/tasks/roadmap.md` §v1.11。完成 `docs/tasks/v1.11-todo.md` 中的人工冒煙測試與簽核後，狀態改為 **SHIPPED**。

## 目標

降低第一次使用的門檻。目前唯一的執行方式是 `git clone` 加上 `npm`，而且啟動後直接進入編輯器。v1.11 讓本工具**可以在瀏覽器中透過公開網址開啟**，並提供**精緻的登陸頁**（以 jsoncrack.com 為模型）。此外，v1.11 加入四項編輯器內的易用性改善。這四項改善來自對高星數開源視覺化工具的調查（jsoncrack、Excalidraw、tldraw、React Flow、Rete.js、Groot2）。本機 clone 仍然支援，但在 README 中降為次要途徑。

**使用者：** 機器人工程師與學習行為樹的學生，也包括想先試用、再決定是否 clone 的首次訪客。

**成功的樣貌：** 訪客開啟 `https://elliewlh2094.github.io/behavior-tree-visualization-tool/`，從登陸頁了解這個工具的用途，點擊進入編輯器。在編輯器中，訪客可以搜尋大型樹、從範例範本開始，並在遺失未存變更之前收到警告。

## 技術棧（相對於 v1.10 的差異）

- **新相依套件：** `react-router-dom`（HashRouter）。專案的第一個路由器。見 AD7。
- **新 CI：** GitHub Actions → GitHub Pages（`actions/configure-pages`、`upload-pages-artifact`、`deploy-pages`）。
- 其他部分不變：React + TS + Vite + `@xyflow/react` + Zustand + Tailwind + `vite-plugin-pwa`。

## 指令

```
Dev:        npm run dev          # http://localhost:5173，base '/'，沒有 PWA service worker
Build:      npm run build        # tsc -b && vite build，base '/behavior-tree-visualization-tool/'
Preview:    npm run preview      # 以 PWA service worker 提供 dist/（可能提供過期的套件）
Preview-dev:npm run preview:dev  # 以停用 PWA 的方式提供 dist/
Typecheck:  npm run typecheck
Lint:       npm run lint
Unit tests: npm run test:ci
E2E tests:  npm run test:e2e
```

## 專案結構（新增／變更的路徑）

```
src/App.tsx                         → HashRouter + Routes（原本是布林狀態機）
src/routes/EditorRoute.tsx          → 新增：編輯器外殼（畫布 + ReactFlowProvider）；StartScreen 移除
src/components/landing/LandingPage.tsx → 新增：行銷風格的介紹頁（#/）
src/components/canvas/SearchBox.tsx → 新增：浮動的 Ctrl+F 搜尋列
src/templates/{index,patrol,chase}.ts → 新增：序列化的範例樹 + 登錄表
src/hooks/useDirtyTracking.ts       → 新增：document 參照 → dirty 旗標
src/hooks/useBeforeUnload.ts        → 新增：dirty 時的原生卸載守衛
src/hooks/useLoadTemplate.ts        → 新增：反序列化範本 → setDocument（重用 useFileOpen 的路徑）
.github/workflows/deploy.yml        → 新增：Pages CI
vite.config.ts                      → 依指令設定 base；PWA scope 不變
index.html, Toolbar.tsx              → 靜態資源路徑改用 import.meta.env.BASE_URL
```

## 程式風格

符合既有慣例。能感知 base 的靜態資源參照（v1.11 特有的寫法）：

```tsx
// 正確：dev 時解析為 '/'，build 時解析為 '/behavior-tree-visualization-tool/'
<img src={`${import.meta.env.BASE_URL}${theme === 'dark' ? 'icon-dark.svg' : 'icon.svg'}`} />

// 錯誤：在子路徑 base 下會得到 404
<img src="/icon.svg" />
```

`setCenter` 一律要明確傳入 `zoom`（省略時，縮放會跳回 1.0）：

```ts
const { setCenter, getZoom } = useReactFlow();
setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2,
          { zoom: getZoom(), duration: 200 });
```

## 測試策略

- **單元（Vitest）：** `tests/unit/...`：範本反序列化的往返；dirty 旗標的狀態轉換（變更 → dirty、儲存 → clean、開啟 → clean、沒有實際變更 → clean）；搜尋篩選（不分大小寫、只限目前的樹）；`markSaved` 清除旗標。
- **元件（Vitest）：** `tests/unit/components/...`：SearchBox 的符合數量與下一個／上一個；LandingPage CTA 的導航。
- **E2E（Playwright）：** `e2e/...`：登陸頁 → 編輯器路由；Ctrl+F 搜尋與按 Enter 置中；載入範本；dirty 標題標記，以及（可測試時）beforeunload。
- **不可退步：** 不得低於 441 個單元測試與 48 個 e2e 測試的基準；新測試只能增加。

## 邊界

- **一律執行：** 每次 commit 前執行 `typecheck`、`lint` 與 `test:ci`；透過 `import.meta.env.BASE_URL` 或 `import` 參照靜態資源；呼叫 `setCenter` 時明確傳入 `zoom`；PWA 的 `start_url`／`scope` 維持 `'.'`。
- **先詢問：** 新增 `react-router-dom`（AD7，已在本規格中核准）；任何對 PWA manifest `start_url`／`scope` 的變更；修改檔案格式 schema。
- **禁止：** 自行勾選人工冒煙測試的核取方塊（由人工執行；自動化只能加上 `_Evidence:_`）；在含有 `react-router-dom` 的 lockfile 提交之前推送到 `main`；在絕對路徑 `/asset` 尚未修正時部署（會破壞線上的標誌與 PWA 圖示）。

---

## 功能規格

### FR3 — 登陸頁與路由

**內容：** 位於 `#/` 的 jsoncrack 風格介紹頁，包含主視覺區（標題、副標題、「Go to Editor」CTA 按鈕）、功能重點區與產品截圖。編輯器移到 `#/editor`。路由使用 **HashRouter**（AD7）。

> **修訂（Checkpoint A 審查之後）：** 原本的設計保留 `StartScreen`（New Tree／Open File），作為編輯器路由內的初始狀態。使用者回饋指出，有了登陸頁之後，這個中間畫面是多餘的：LandingPage 已經負責品牌與入口，store 會預先建立只有一個 Root 的空白文件，而 Toolbar 也已經有「Open」動作。**`StartScreen` 已移除**，`#/editor` 直接進入畫布。`StartScreen.tsx`、它的單元測試與 `e2e/start-screen.spec.ts` 已刪除；編輯器的 e2e 測試不再需要關閉起始畫面。

**驗收條件：**
- `#/` 渲染 `<LandingPage>`；`#/editor` 渲染編輯器外殼。
- LandingPage 主視覺區的 CTA 導航到 `#/editor`。
- `#/editor` 直接進入畫布（store 預先建立只有一個 Root 的文件）；開啟既有檔案由 Toolbar 的「Open」動作負責。沒有中間的起始畫面。
- `ReactFlowProvider` 只包住 `#/editor`，不包住登陸頁。
- 主題／偏好設定在兩個路由上都生效（hooks 提升到 `App`）。
- 直接載入並重新整理 `#/editor` 可以正常運作（HashRouter 不需要伺服器改寫）。
- LandingPage 支援響應式版面（在行動裝置寬度下不跑版），並相容暗色模式。

**範圍：** M。**檔案：** `src/App.tsx`、`src/routes/EditorRoute.tsx`（新增）、`src/components/landing/LandingPage.tsx`（新增）、`package.json`。_已移除：`src/components/start-screen/`、`tests/unit/components/StartScreen.test.tsx`、`e2e/start-screen.spec.ts`。_

### FR5 — GitHub Pages 部署

**內容：** 把 PWA 發佈到 GitHub Pages，讓任何人不必購買網域，就能在瀏覽器中開啟。推送到 `main` 時自動部署。

**驗收條件：**
- `vite.config.ts` 設定 `base: command === 'build' ? '/behavior-tree-visualization-tool/' : '/'`。`npm run dev` 維持在 `/`。
- 所有原本為絕對路徑的靜態資源（`index.html` 圖示、`Toolbar.tsx`、`StartScreen.tsx`、任何 LandingPage 靜態資源）都能在子路徑 base 下解析（透過 `import.meta.env.BASE_URL` 或靜態 `import`）。**線上不得出現 404。**
- PWA 的 `start_url`／`scope` 維持 `'.'`；`navigateFallback` 在 base 下能正確解析。部署後的應用程式可以離線重新載入。
- `.github/workflows/deploy.yml` 的設定：
  - 觸發條件：`push` 到 `main` 與 `workflow_dispatch`。
  - 權限：`pages: write`、`id-token: write`。
  - concurrency 群組：`pages`。
  - Node 20。
  - 步驟：`npm ci` → `npm run build` → `configure-pages`／`upload-pages-artifact`（`dist`）／`deploy-pages`。
- README 開頭放上線上網址；clone／本機執行說明降為次要章節。

**範圍：** S–M。**檔案：** `vite.config.ts`、`index.html`、`src/components/toolbar/Toolbar.tsx`、`src/components/start-screen/StartScreen.tsx`、`.github/workflows/deploy.yml`（新增）、`README.md`。

### FR6 — 節點搜尋（Ctrl+F）

**內容：** 在畫布上按 Ctrl+F 叫出浮動搜尋列（jsoncrack 模型）。它在**使用中的樹**內，以名稱子字串（不分大小寫）篩選節點、醒目標示符合項，並逐一跳到每個符合項並置中。

**驗收條件：**
- 焦點不在可編輯欄位時，按 Ctrl+F 會開啟浮動 SearchBox，並以 `preventDefault` 阻止瀏覽器的頁內搜尋。
- 輸入文字時，以 `name.toLowerCase().includes(query)` 篩選使用中樹的節點；符合項以獨特的醒目標示（琥珀色外框）顯示，**不**重用選取狀態的外觀。
- 計數器顯示 `current/total`（例如 `2/5`），並標示「(current tree)」。
- Enter／↓ 跳到下一個符合項；Shift+Enter／↑ 跳到上一個；目前符合項透過 `setCenter(..., { zoom: getZoom(), duration: 200 })` 置中，縮放比例保持不變。
- Esc 關閉搜尋列並清除醒目標示。
- 搜尋狀態是暫態的（不進入 undo/redo 歷史紀錄）。
- 跨樹搜尋**不在** v1.11 範圍內（只限使用中的樹）。

**範圍：** M。**檔案：** `src/store/bt-store.ts`（暫態的 `searchOpen`、`searchMatchIds`）、`src/components/canvas/SearchBox.tsx`（新增）、`src/components/canvas/Canvas.tsx`、`src/components/canvas/BTNode.tsx`、`src/components/toolbar/Toolbar.tsx`。

### FR7 — 小地圖：2026-06-25 延後（AD9）

**內容：** 使用 React Flow 內建的 `<MiniMap>` 瀏覽大型樹。

**狀態：** 已建置並驗證（commit `bb009e0`，5/5 項冒煙測試通過），然後在**出貨前移除**。以實際的樹測試後發現，內建的 MiniMap 只繪製著色的節點色塊，沒有標籤與連線。對由上而下的行為樹而言，它傳達的結構資訊很少，而且與 FR6 搜尋已滿足的「找到節點」需求重疊。實作保留在 git 歷史中（可透過 `git revert`／cherry-pick 恢復）；FR7 是延後，不是捨棄。有使用者需求，或有能繪製標籤與連線的自製小地圖節點元件時，再重新評估。完整理由：`docs/adr/009`。

**原本的驗收條件（供日後重新評估 FR7 時使用）：**
- MiniMap 顯示在畫布上；`nodeColor` 與各類型 `BTNode` 的色彩一致；`maskColor`／`bgColor` 與使用中的主題（淺色／暗色）一致。
- 圖片匯出期間（`exportInProgress`）隱藏 MiniMap，做法比照 AxisOverlay／OriginCross。

**範圍：** XS。**檔案：** `src/components/canvas/Canvas.tsx`。

### FR8 — 範例範本

**內容：** 出貨一小組範例樹，讓使用者可以從範例開始，學生也能立即得到一棵可運作的樹。

**驗收條件：**
- 至少兩個範本（Patrol、Chase），以 v2 schema 序列化的 JSON 字串存放在 `src/templates/`，並有登錄表（`{ id, name, description, json }`）。_出貨時修訂：**只有 Chase**。Chase 以 `SubTree` 的形式內含 Patrol，所以獨立的 Patrol 卡片是多餘的（見 todo T12 的修訂）。_
- LandingPage 上的「Start from a template」入口透過既有的 `deserialize → setDocument → setFileName` 路徑載入範本，然後導航到 `#/editor`。
- 載入後：樹的驗證沒有任何問題；`fileName` 反映範本名稱；`dirty` 為 `false`（範本視為「已開啟的文件」，而不是未存的編輯）。

**範圍：** S。**檔案：** `src/templates/{index,patrol,chase}.ts`（新增）、`src/hooks/useLoadTemplate.ts`（新增）、`src/components/landing/LandingPage.tsx`。

### FR9 — 未存變更守衛

**內容：** 儲存是手動按 Ctrl+S 觸發的 Blob 下載，沒有自動儲存。因此，在使用者遺失未存的編輯之前，必須先警告。追蹤 **dirty** 旗標並顯示出來。

**驗收條件：**
- 新的 store 狀態 `dirty: boolean`（預設 `false`）與 `lastSavedDocument`。dirty 由一個訂閱設定：當 `document` 物件的**參照**改變、且不同於 `lastSavedDocument` 時觸發。這種做法涵蓋每一個變更動作，包括不經過 `withSnapshot` 的動作（`moveNode`、`reorderChildren`、`updateNodeName`）。沒有實際變更的 `return {}` 會保留相同參照，所以**不會**誤設 dirty。
- `markSaved()`（儲存成功後呼叫）與 `setDocument`（開啟檔案／載入範本）會清除 dirty，並重設 `lastSavedDocument`。
- dirty 時：`document.title` 前面加上 `● `，檔名欄位顯示一個小圓點指示符號。
- dirty 時：`beforeunload` 觸發瀏覽器原生的「要離開網站嗎？」提示；不是 dirty 時則不觸發。
- 會改變 document 參照的 undo/redo 會標記為 dirty。這是正確的行為（狀態與上次儲存時不同）。

**範圍：** S–M。**檔案：** `src/store/bt-store.ts`、`src/hooks/useDirtyTracking.ts`（新增）、`src/hooks/useBeforeUnload.ts`（新增）、`src/components/toolbar/Toolbar.tsx`、`src/App.tsx`（標題 hook）。

---

## 成功標準（版本層級，可測試）

1. 線上網址提供登陸頁，且沒有任何 404 的靜態資源；CTA 能到達 `#/editor`；重新整理 `#/editor` 可以正常運作。
2. Ctrl+F 搜尋會醒目標示符合項並置中，縮放比例保持不變；Esc 關閉；瀏覽器的頁內搜尋被阻止。
3. ~~小地圖正常渲染、主題一致，且不出現在匯出的 PNG 中。~~ **2026-06-25 延後（AD9）**：小地圖在出貨前移除，見 `docs/adr/009`。
4. 範本載入後是一棵乾淨、合法的樹，且 `dirty=false`。
5. 編輯會設定 `●` 標題標記並啟用 beforeunload；Save 會清除兩者。
6. `npm run typecheck && npm run lint && npm run test:ci && npm run test:e2e` 全部通過；GitHub Actions 部署成功。
7. Lighthouse 分數 ≥ v1.10 基準（路由器與登陸頁不造成退步）。

## 已決議問題（使用者於 2026-06-22 確認）

- **登陸頁文案與截圖：** 第一版使用暫定文案與 README 既有的截圖；在瀏覽器中審查後，再調整視覺與文案細節。
- **範本數量：** 先做 2 個（Patrol、Chase）；流程驗證可行後再擴充。
- **dirty 指示符號的形式：** **兩者都出貨**：`● ` 標題前綴（分頁／視窗層級，跨分頁可見）**與**工具列檔名旁的圓點（應用程式內，與檔名綁定）。無論如何，`beforeunload` 原生提示都會出貨。儲存時兩者一起清除。
