# 規格：Behavior Tree Visualization Tool

> 狀態：**已核准。Phase 1 全部定案；Phase 2 的待決事項 A 與 B 已於 2026-04-22 結案。**
> 最後更新：2026-04-22

## 目標

一個輕量、離線優先的工具，透過拖放式畫布介面**編輯、視覺化與驗證行為樹（BT，Behavior Tree）**。目標使用者是機器人工程師與學習行為樹的學生。

視覺與互動參考 [Groot2](https://www.behaviortree.dev/groot) 與 [Canva](https://www.canva.com)；操作方式參考 [Peko-Step](https://www.peko-step.com)：不需要帳號、不使用雲端，只在本機開啟、編輯與儲存檔案。

### 目標使用者
- **機器人工程師**：編輯並檢查實際機器人系統中使用的行為樹。
- **學習行為樹的學生**：探索結構、進行實驗、以視覺方式理解節點關係，而不必承擔引擎或執行環境的負擔。

### 成功的樣貌
第一次使用的使用者可以開啟工具、設計一棵有一定規模的行為樹（10 個以上節點）、驗證其結構、儲存為 JSON 檔，之後再重新開啟。整個過程不需要安裝工具鏈、不需要登入，也不需要連線到伺服器。

### 主要使用情境
1. **編輯**：以拖放方式從零建立新的樹。
2. **按需除錯結構**：載入既有的樹，檢查並驗證其拓撲。*（執行期 tick 除錯不在範圍內，見「非目標」。）*
3. **修改**：開啟既有的 JSON 樹，編輯後存回。

### 非目標
- 即時／實況執行的 tick 視覺化（不連線到機器人或模擬器）。
- 多專案／專案清單／工作區管理。
- 多人協作、雲端同步、帳號系統、後端服務。
- v1 不支援外部格式（例如 BehaviorTree.CPP XML）的匯入／匯出，見「採用的預設值」（Q7）。
- **Draw.io 風格的智慧對齊參考線**（當一個圖形與另一個圖形的邊緣／中心對齊時出現的虛線）。v1 只需要貼齊格線；智慧參考線延後。*（2026-04-22 在 S2 審查中決定。）*

## 技術棧（已核准）

| 層級 | 選擇 | 理由 |
|---|---|---|
| 語言 | **TypeScript** | 對結構化資料工具（樹、驗證器、schema）而言，型別安全的效益很高。 |
| 框架 | **React 18** | 節點編輯器相關元件的生態系最大；React Flow 屬於這個生態系。 |
| 建置工具 | **Vite** | 開發循環最快；輸出可部署到任何地方的靜態套件。 |
| 畫布／圖形 | **React Flow（`@xyflow/react`）** | 專為拖放式節點編輯器打造。提供平移、縮放、連線、貼齊格線與自訂節點。Apache-2.0 授權。 |
| 狀態 | **Zustand** + 小型 undo/redo 環形緩衝區 | 樣板程式碼最少；與 React Flow 自身的模式相容。 |
| 樣式 | **Tailwind CSS** | UI 迭代快速；沒有 CSS-in-JS 的執行期成本。 |
| 檔案 I/O | 瀏覽器 `File` API + `Blob` 下載 | 符合 Peko-Step 的「上傳／下載」使用體驗。不需要伺服器。 |
| 封裝 | **PWA**（可安裝、可離線使用的網頁應用程式） | 沒有執行檔，也沒有安裝程式。使用者造訪網址一次後，service worker 會快取應用程式外殼以供離線使用。決策：原生桌面版（Tauri）延後到 v2 以後，等使用者提出需求再考慮。 |
| PWA 執行環境 | `vite-plugin-pwa`（底層為 Workbox） | 以最少的設定產生 service worker 與 manifest。 |
| 測試 | Vitest + React Testing Library + Playwright | 分別用於單元、元件與 e2e 測試。 |
| Lint／格式化 | ESLint + Prettier | 標準做法。 |

## 指令

```bash
npm install             # 一次性安裝
npm run dev             # 在 http://localhost:5173 啟動 Vite 開發伺服器
npm run build           # 建置靜態套件到 dist/（已支援 PWA；可部署到任何靜態主機）
npm run preview         # 在本機預覽正式版建置（service worker 在此模式下啟用）
npm test                # 以監看模式執行 Vitest
npm run test:ci         # 執行一次 Vitest 並產生覆蓋率報告
npm run test:e2e        # 執行 Playwright 端對端測試
npm run lint            # ESLint --fix
npm run typecheck       # tsc --noEmit
```

## 專案結構

```
behavior-tree-visualization-tool/
├── src/
│   ├── main.tsx                    # Vite 進入點
│   ├── App.tsx                     # data router：#/ 登陸頁、#/editor 編輯器
│   ├── routes/                     # 路由元件（EditorRoute：編輯器外殼）
│   ├── components/
│   │   ├── canvas/                 # React Flow 包裝、自訂節點、畫布控制列、搜尋列
│   │   ├── toolbar/                # 上方工具列（檔案開啟／儲存、undo/redo、驗證、排版、匯出）
│   │   ├── tab-bar/                # 多樹分頁列
│   │   ├── node-palette/           # 新節點的拖曳來源
│   │   ├── sidebar/                # 右側側邊欄（Properties／Settings 分頁）
│   │   ├── property-panel/         # 屬性面板
│   │   ├── settings/               # 設定面板（主題、格線、節點色彩系列）
│   │   ├── validation/             # 驗證面板
│   │   ├── export/                 # 圖片匯出對話框
│   │   ├── move-copy/              # 跨樹移動／複製對話框
│   │   ├── landing/                # 登陸頁
│   │   └── common/                 # 共用元件（未存變更對話框）
│   ├── core/                       # 不依賴 React 的純邏輯
│   │   ├── model/                  # 行為樹資料型別與純函式操作
│   │   ├── schema/                 # 檔案格式的 zod schema
│   │   ├── validation/             # 結構規則 R1–R10
│   │   ├── serialization/          # 序列化、反序列化、v1 → v2 遷移
│   │   ├── layout/                 # 自動排版
│   │   ├── history/                # undo/redo 環形緩衝區
│   │   └── config/                 # 格線等常數
│   ├── store/                      # Zustand store（文件與歷史紀錄、偏好設定）
│   ├── hooks/                      # 可重用的 React hooks
│   ├── templates/                  # 登陸頁的範例範本
│   └── styles/                     # Tailwind 進入點 + 主題 token
├── public/                         # 靜態資源（PWA 圖示、字型、標誌、截圖）；manifest 由 vite-plugin-pwa 在建置時產生
├── tests/
│   ├── setup.ts                    # Vitest 測試環境設定
│   └── unit/                       # Vitest：純邏輯、store、hooks，以及 components/ 下的元件測試
├── e2e/                            # Playwright 測試規格與 fixtures/
├── scripts/                        # PWA 圖示產生、Lighthouse 稽核腳本
├── .github/workflows/              # GitHub Pages 部署
├── docs/                           # 文件
│   ├── SPEC.md                     # 本檔案：持續更新的單一事實來源
│   ├── bt-json-format.md           # 自訂 JSON 格式規格
│   ├── adr/                        # 架構決策紀錄
│   ├── tasks/                      # roadmap 與版本 todo
│   ├── lighthouse/                 # 最近一次發版的 Lighthouse 稽核報告
│   └── screenshots/                # README 使用的截圖
├── README.md                       # 專案概述 + 快速入門（另有 README.zh-TW.md）
├── user-guide.md                   # 給終端使用者的鍵盤與 UI 參考（另有 user-guide.zh-TW.md）
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── playwright.config.ts
```

## 程式風格

- **命名：** 型別與 React 元件使用 `PascalCase`；變數與函式使用 `camelCase`；最上層常數使用 `SCREAMING_SNAKE_CASE`；檔名使用 kebab-case（元件檔案除外，元件檔名與元件名稱相同）。
- **一個檔案一件事：** 每個檔案只有一個主要匯出，並以檔名命名。
- **不使用 default export**，Vite 進入點除外。只使用具名匯出，讓 grep 與 IDE 重構能正確運作。
- **`core/` 中優先使用純函式**：`src/core/` 下的所有程式碼都必須不依賴框架，並且不需要 React 就能進行單元測試。
- **註解不描述*做了什麼***：只在不明顯時說明*為什麼*（不變條件、棘手的邊界情況、行為樹文獻連結）。

範例：

```ts
// src/core/model/node.ts

// 固定列舉：v1 不允許使用者自訂節點類型。
export const NODE_KINDS = [
  'Root',
  'Sequence',
  'Fallback',
  'Parallel',
  'Decorator',
  'Action',
  'Condition',
  'Group',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface BTNode {
  id: string;
  kind: NodeKind;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
}

export interface BTConnection {
  id: string;
  parentId: string;
  childId: string;
  // 對 Sequence／Fallback／Parallel 而言，兄弟節點的次序具有語意。
  // `order` 是非負整數；數值越小越先執行（在畫布上由左至右）。
  order: number;
}

export interface BehaviorTree {
  version: 1;
  nodes: BTNode[];
  connections: BTConnection[];
  rootId: string;
}
```

## 測試策略

| 層級 | 工具 | 位置 | 涵蓋內容 |
|---|---|---|---|
| 單元 | Vitest | `tests/unit/` | `src/core/` 中的純邏輯：model 操作、驗證器、序列化、歷史紀錄環形緩衝區。目標：`src/core/` 的行覆蓋率 ≥90%。 |
| 元件 | Vitest + React Testing Library | `tests/unit/components/` | 獨立測試個別 React 元件：屬性面板的渲染、節點面板的拖曳來源、工具列按鈕。 |
| 端對端 | Playwright | `e2e/` | 完整使用流程：啟動 → 建立樹 → 驗證 → 儲存 → 重新載入。針對 `npm run preview` 執行。 |

**規則：**
- 每個錯誤修正都必須附上回歸測試（「Prove-It」模式）。
- 不為沒有邏輯的純渲染／JSX 寫測試，那只是快照雜訊。
- 驗證規則以表格驅動測試：每條規則一個測試，各附一個合法與一個不合法的測試資料。

## 邊界

### 一律執行
- 讓 `src/core/` 不匯入 React 與 DOM，確保它可移植且可單元測試。
- 每次 commit 前執行 `npm run typecheck && npm test && npm run lint`。
- 資料模型改變時，更新本檔案（`docs/SPEC.md`）與 `docs/bt-json-format.md`。
- 修正錯誤時加入回歸測試。
- 維持 undo/redo 緩衝區的上限（10 筆，`src/store/bt-store.ts` 的 `HISTORY_CAPACITY`）。

### 先詢問
- 新增執行期相依套件（npm 套件）。寧可自己寫約 50 行程式碼，也不要引入一整串間接相依套件。
- 修改 JSON 檔案格式（破壞性變更需要提升 `version` 並提供遷移路徑）。
- 新增行為樹節點類型（會影響驗證器、節點面板、屬性面板與文件）。
- 修改驗證規則。
- 引入任何形式的後端、網路呼叫或遙測。

### 禁止
- 提交機密、API 金鑰或 `.env` 檔案。
- 加入帳號系統、登入流程或使用者身分概念。
- 從核心應用程式發出網路呼叫（分析、CDN 字型、遠端設定，一律不行）。
- 編輯 `node_modules/` 或 `dist/` 中的第三方檔案。
- 在沒有記錄原因且未經人工核准的情況下，移除或略過失敗的測試。

## 成功標準

以下條件全部成立時，v1 才算「完成」：

1. **啟動後立即可編輯。** 開啟應用程式（在瀏覽器中或以已安裝的 PWA 開啟）時，顯示一個只有單一不可刪除 Root 節點的畫布。沒有啟動畫面、沒有登入、沒有專案選擇器。
2. **節點生命週期。** 使用者可以從節點面板拖曳建立節點、移動節點、透過屬性面板編輯名稱與類型，以及刪除節點。刪除非根節點時，其子節點會失去連線（子樹保留為孤立節點）。
3. **連線生命週期。** 使用者可以在連接埠之間拖曳，畫出父→子連線，也可以刪除連線。
4. **畫布互動。**
   - 平移（拖曳背景）、縮放（滾輪／雙指縮放）。
   - 放下新節點（從節點面板拖入）與拖曳既有節點時，都會貼齊格線。
   - 格線大小由單一常數設定（`src/core/config/grid.ts`，預設 25 px）。
   - 節點尺寸是格線大小的整數倍（預設 150 × 75 px = 6 × 3 格），所以每個節點的邊緣都落在格線上。
   - Draw.io 風格的線條背景在視覺上強化格線。
   - 左下角顯示 React Flow 內建的控制項覆蓋層：放大／縮小、適應視圖，以及「切換互動」鎖定。鎖定後，圖形進入唯讀模式（停用節點拖曳、連線與選取），適合截圖與展示。見 Q9。
5. **Undo/redo。** 最多 10 步，快捷鍵為 Ctrl+Z／Ctrl+Shift+Z。超過 10 步的舊紀錄會被丟棄。
6. **按需驗證。** 「Validate」按鈕執行結構檢查（見 `docs/bt-json-format.md` §5 結構規則）。錯誤與警告顯示在面板中，每一項都有可點擊的參照，點擊後選取造成問題的節點。
7. **檔案 I/O。** 「Open」從磁碟載入 `.json` 檔；「Save」把目前的樹下載為 `.json`。往返（round-trip）不失真。
8. **可安裝為 PWA 並可離線使用。** `npm run build` 產生可部署的靜態套件，內含有效的 `manifest.webmanifest`，以及快取應用程式外殼的 service worker。首次載入後，應用程式在沒有網路的情況下也能運作。Lighthouse PWA 稽核通過。
9. **往返後保留子節點次序。** 在 Sequence 下重新排列子節點、儲存、重新載入後，次序維持不變。
10. **文件齊備。** `docs/bt-json-format.md` 定義 JSON schema。`README.md` 有 5 行的快速入門。

## 已決議事項

| # | 問題 | 決策 |
|---|---|---|
| Q1 | 封裝方式 | v1 **只提供 PWA**。不提供 Tauri／Electron 執行檔。只有使用者明確提出需求時，才在 v2 以後重新考慮。 |
| Q2 | 節點類型 | **固定列舉**（v1 不開放使用者擴充）：`Root, Sequence, Fallback, Parallel, Decorator, Action, Condition, Group`。**8 種類型全部在 v1 出貨**（2026-04-22 確認；待決事項 A 結案）。依 Q4，各類型專屬的屬性仍延後到 v2。`SubTree`（參照另一棵樹的葉節點）保留給 v1 之後；由於 v1 用這個節點做樹內的視覺分組，而不是參照檔案，因此 2026-04-23 改名為 `Group`。 |
| Q3 | 驗證規則 | 依提案**核准**：只有一個 Root，且 Root 恰好有一個子節點；Action／Condition 是葉節點；Sequence／Fallback／Parallel 至少要有 1 個子節點；Decorator 恰好有 1 個子節點；不可有循環；每個非根節點恰好有一個父節點，或是明確的孤立節點；孤立節點產生警告，而不是錯誤。 |
| Q5 | 子節點次序 | **保留在 JSON 中。** `BTConnection.order` 是非負整數；同一父節點下的兄弟節點依 `order` 由小到大，由左至右渲染與執行。往返必須不失真。 |

## 採用的預設值

*（原本由代理提出作為預設值；2026-04-22 由人工確認。）*

| # | 問題 | 決策 |
|---|---|---|
| Q4 | 屬性面板範圍 | **v1 = 只有名稱與類型。** 各類型專屬的屬性（Decorator 內部類型、Parallel 成功門檻等）延後到 v2。讓 v1 保持簡潔的介面。 |
| Q6 | 鍵盤快捷鍵 | **v1 組合：** Ctrl/Cmd+Z（undo）、Ctrl/Cmd+Shift+Z（redo）、Delete/Backspace（刪除選取項目）、Ctrl/Cmd+S（儲存）、Ctrl/Cmd+O（開啟）、Ctrl/Cmd+A（全選）。 |
| Q7 | 匯入外部格式 | **不在 v1 範圍內。** 只支援本工具的自訂 JSON。 |
| Q8 | 簡報資料夾 | **不追蹤。** `screenshots-for-presentation/` 與 `text-contents-for-presentation/` 不放進儲存庫，它們是本機的暫存／參考素材。`.gitignore` 排除這兩個資料夾。*（2026-04-22 修訂：先前的文字寫「維持追蹤」，但它們從未加入儲存庫。已釐清意圖，使其符合實際情況。）* |
| Q9 | 畫布控制項覆蓋層 | **保留 React Flow 預設的 `<Controls />` 覆蓋層，位於左下角。** 包含放大／縮小、適應視圖，以及「切換互動」（唯讀鎖定）。在 S1 審查中決定（2026-04-22）。保留鎖定切換的原因是：它是零成本、適合展示與截圖的功能。它會同時切換 `nodesDraggable`、`nodesConnectable` 與 `elementsSelectable` 三個旗標。 |

## 待決事項

*（Phase 2 的待決事項已於 2026-04-22 解決。目前沒有待決事項。）*

- ~~**待決事項 A：v1 的節點類型涵蓋範圍。**~~ **2026-04-22 結案。** 8 種類型全部在 v1 出貨。見上方 Q2。
- ~~**待決事項 B：JSON 格式規格。**~~ **2026-04-22 結案。** 見 [`docs/bt-json-format.md`](./bt-json-format.md)。
