# 行為樹 JSON 格式

> 狀態：**目前版本為 v2**（隨工具 v1.4 出貨）。開啟 v1 檔案時會接受並自動遷移；所有儲存都輸出 v2。
> 最後更新：2026-05-08
> 相關文件：[`SPEC.md`](./SPEC.md)（範圍的權威來源）、`src/core/model/*`（TypeScript 對應實作）、[`adr/005-document-model-and-file-format-v2.md`](./adr/005-document-model-and-file-format-v2.md)（從 v1 升級到 v2 的理由）。

本文件定義 Behavior Tree Visualization Tool 使用的磁碟檔案格式。本文件具規範性：載入器、序列化器與 schema 驗證器都必須符合本文件的規定。任何不一致，不是本文件的錯誤，就是程式碼的錯誤。

v2 新增了多樹文件外層（`BTDocument`），以支援 `SubTree` 節點類型（一種以名稱參照另一棵樹的節點）。v1 單樹檔案會永久保持可讀；遷移語意見 §8。

## 1. 檔案慣例

| 項目 | 值 |
|---|---|
| 副檔名 | `.json` |
| 編碼 | UTF-8。不接受 BOM。 |
| MIME 類型 | `application/json` |
| 換行字元 | 寫入端輸出 `\n`。讀取端接受 `\n` 與 `\r\n`。 |
| 排版 | 寫入端輸出以 2 個空白縮排的格式化 JSON。讀取端接受任何 JSON 空白字元。 |
| 寫入輸出的鍵順序 | 頂層：`version, mainTreeId, trees`。每棵樹：`id, name, rootId, nodes, connections`。每個節點：`id, kind, name, position, properties, treeRef`（沒有 `treeRef` 時省略）。每條連線：`id, parentId, childId, order`。 |

**為什麼寫入時要固定鍵順序？** 這樣，對未修改的樹執行 `save → load → save` 時，會產生逐位元組相同的輸出（S8 成功標準依賴這一點）。`JSON.stringify` 搭配自訂 replacer 強制執行這個順序；讀取端忽略鍵順序（標準 JSON 語意）。

## 2. 頂層結構

v2 文件是一個 `BTDocument`，也就是包住一個或多個樹定義的外層。

```json
{
  "version": 2,
  "mainTreeId": "<tree-id>",
  "trees": [ /* BTTreeDef[] */ ]
}
```

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `version` | 整數字面值 `2` | 是 | 格式版本。寫入端只輸出 v2；載入器也接受 `1` 並進行遷移（見 §8）。 |
| `mainTreeId` | string | 是 | 進入點樹定義的 `id`。必須等於 `trees` 中某個成員的 `id`。 |
| `trees` | 非空的 `BTTreeDef` 陣列 | 是 | 文件中的所有樹定義。至少要包含一棵樹（主樹）。文件內的樹 `name` 必須**唯一**，因為 `SubTree.treeRef` 以名稱查找參照（見 §3.1）。 |

**頂層的未知欄位會被拒絕**（schema 嚴格模式）。日後版本即使只是新增欄位，也必須提升 `version`。

### 2.1 `BTTreeDef` 結構

```json
{
  "id": "tree-uuid",
  "name": "Main",
  "rootId": "<node-id>",
  "nodes": [ /* BTNode[] */ ],
  "connections": [ /* BTConnection[] */ ]
}
```

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | 非空 string | 是 | 在文件內唯一。不透明值，任何穩定的字串都可以。工具寫入 UUIDv4。供 `mainTreeId` 與編輯器各分頁的狀態使用。SubTree 節點的參照目標**不是** `id`，而是 `name`（見 §3.1）。 |
| `name` | 非空 string | 是 | 供人閱讀的標籤，顯示在分頁上。SubTree 節點以這個值參照樹。在 `trees` 中必須唯一。 |
| `rootId` | string | 是 | 這棵樹的 `Root` 節點的 `id`。單樹規則與 v1 相同，見 §3 與 §5。 |
| `nodes` | `BTNode` 陣列 | 是 | 這棵樹的節點。空陣列會被拒絕，因為至少必須有 Root。 |
| `connections` | `BTConnection` 陣列 | 是 | 這棵樹的父→子連線。可以是空陣列。 |

**樹上的未知欄位會被拒絕。**

### 2.2 v1（舊版）頂層結構

v1 檔案（`version: 1`）直接在頂層存放單一樹的資料，沒有外層：

```json
{
  "version": 1,
  "rootId": "<node-id>",
  "nodes": [ /* BTNode[] */ ],
  "connections": [ /* BTConnection[] */ ]
}
```

載入器依 `version` 的字面值辨識 v1，並交給 `migrateV1toV2` 處理，見 §8。

## 3. `BTNode` 結構

```json
{
  "id": "f2e0c8a0-1b2c-4d3e-8f9a-1234567890ab",
  "kind": "Sequence",
  "name": "Pick up object",
  "position": { "x": 320, "y": 160 },
  "properties": {}
}
```

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | 非空 string | 是 | 在文件內（跨所有樹）唯一。不透明值，任何穩定的字串都可以。工具寫入 UUIDv4。 |
| `kind` | 9 個 `NodeKind` 字面值之一 | 是 | 見 §3.1。 |
| `name` | string（可以是空字串） | 是 | 供人閱讀的標籤。對 `SubTree` 節點，編輯器讓 `name` 與 `treeRef` 保持同步（重新命名被參照的樹時，會一併更新這個欄位）。 |
| `position` | `{x: number, y: number}` | 是 | 畫布座標，單位為縮放 1:1 時的 CSS 像素。允許浮點數與負數。 |
| `properties` | object（record） | 是 | 保留給日後各類型專屬的資料。載入器在往返時保留這個欄位；接受非空值，但目前會忽略。 |
| `treeRef` | 非空 string | 僅 `SubTree` | 文件中另一棵樹的名稱，表示這個 SubTree 展開為那棵樹。必須符合某個 `BTTreeDef.name`。其他所有類型都禁止使用這個欄位。 |

**節點上的未知欄位會被拒絕。**

### 3.1 `NodeKind`

只有以下 9 個字串字面值，區分大小寫。

| 類型 | 語意 | 結構規則（見 §5） |
|---|---|---|
| `Root` | 唯一的進入點。每棵樹恰好一個。 | 恰好 1 個子節點。不可作為任何節點的子節點。 |
| `Sequence` | 組合節點：依序 tick 子節點；全部成功時成功，遇到第一個失敗時失敗。 | ≥1 個子節點。 |
| `Fallback` | 組合節點：依序 tick 子節點；遇到第一個成功時成功，全部失敗時失敗。又稱「Selector」。 | ≥1 個子節點。 |
| `Parallel` | 組合節點：tick 所有子節點；成功／失敗策略依類型而定（延後到日後版本）。 | ≥1 個子節點。 |
| `Decorator` | 一元修飾節點，轉換單一子節點的結果。Decorator 的子類型（Inverter、Retry 等）延後到日後版本。 | 恰好 1 個子節點。 |
| `Action` | 葉節點：執行工作，回傳 success／failure／running。 | 沒有子節點。 |
| `Condition` | 葉節點：評估一個述詞，回傳 success／failure。 | 沒有子節點。 |
| `Group` | 視覺／組織用的包裝節點，為樹的一個區域加上標籤。沒有執行期語意，對執行而言是透明的。 | 0..n 個子節點（沒有規則）。 |
| `SubTree` | 葉節點，參照同一份文件中的另一個樹定義。參照依據是 `treeRef`（樹名稱），而不是 id，讓作者能以易讀的名稱思考子樹。 | 沒有子節點（葉節點）。 |

**為什麼以名稱而非 id 參照？** 作者在分頁與屬性面板的下拉選單中看到的是樹名稱；id 是不透明的 UUID。以名稱參照也能在 id 重新產生時（例如 v1 → v2 遷移期間）保持有效，不必改寫 `treeRef` 的值。代價是 `name` 在文件內必須唯一，由 schema 強制執行。

## 4. `BTConnection` 結構

```json
{
  "id": "conn-01",
  "parentId": "<node-id>",
  "childId": "<node-id>",
  "order": 0
}
```

| 欄位 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `id` | 非空 string | 是 | 在文件內唯一。讓連線能獨立於兩端節點被選取與 undo。 |
| `parentId` | string | 是 | 必須參照 `nodes` 中的某個 `id`。 |
| `childId` | string | 是 | 必須參照 `nodes` 中的某個 `id`。不可等於 `parentId`。 |
| `order` | 整數 ≥ 0 | 是 | 在擁有相同 `parentId` 的連線之間的兄弟次序。見 §4.1。 |

**連線上的未知欄位會被拒絕。**

### 4.1 `order` 語意

- `order` 是任意的非負整數，不需要連續（`[0, 5, 10]` 是合法的）。
- 擁有相同 `parentId` 的兄弟節點，**依 `order` 由小到大，由左至右**渲染與執行。
- 允許同值（同一父節點下 `order` 相同）。渲染時依 `id` 字典序由小到大決定次序。這樣渲染結果是確定的，而且載入器不必修改資料。
- **往返不變條件：** 載入器 MUST NOT（絕對不可）在載入時重新編號 `order`。對未修改的樹執行「儲存 → 載入 → 儲存」，會產生逐位元組相同的輸出。

### 4.2 編輯時的重新排序（v1）

編輯器由**水平配置**推導 `order`：每次拖曳手勢結束時，同一父節點下的兄弟節點依 `position.x` 由小到大，重新編號為連續的 `0..n-1`。`x` 相同時，保留被拖曳節點目前的 `order`（穩定排序）。

也就是說，作者在畫布上左右拖曳兄弟節點即可重新排序，不需要專用的排序控制項。理由如下：

- 這符合 §4.1 的渲染規則（依 `order` 由小到大，由左至右），所以畫面次序與邏輯次序不會不一致。
- 每次拖曳只產生一個可 undo 的步驟，同時涵蓋 `position` 與 `order` 的變更（依環形緩衝區歷史紀錄的設計，快照在拖曳開始時建立）。
- 孤立節點（沒有進入的連線）在圖的意義上沒有兄弟節點，所以永遠不會被重新編號。

日後的編輯機制（明確的「左移／右移」按鈕，或批次的「套用排版」工具列指令）可以疊加在現有機制之上，而不必修改磁碟格式。原因是重新編號由純函式 `reorderChildren` 執行，UI 只是它的其中一個呼叫端。

## 5. 結構規則

這些規則由應用程式的「Validate」指令**按需**評估。它們不會阻止檔案載入：格式錯誤的樹仍必須能開啟，讓使用者看到並修正問題。規則分為兩個嚴重等級：**error**（錯誤，表示樹不合法）與 **warning**（警告，編輯過程中可以接受，但會被標示）。

| # | 規則 | 範圍 | 嚴重等級 |
|---|---|---|---|
| R1 | 恰好存在一個 `Root` 節點，且其 `id === rootId`。 | 單樹 | error |
| R2 | `Root` 恰好有 1 條向外的連線（恰好 1 個子節點）。 | 單樹 | error |
| R3 | `Action`、`Condition` 與 `SubTree` 節點有 0 條向外的連線（是葉節點）。 | 單樹 | error |
| R4 | `Sequence`、`Fallback` 與 `Parallel` 節點有 ≥1 條向外的連線。 | 單樹 | error |
| R5 | `Decorator` 節點恰好有 1 條向外的連線。 | 單樹 | error |
| R6 | 由連線構成的有向圖不含循環。 | 單樹 | error |
| R7 | 每個非 Root 節點恰好有 1 條進入的連線，或是 0 條進入的連線。 | 單樹 | 超過 1 個父節點時為 error；0 個父節點（孤立）時為 warning。 |
| R8 | 孤立的非 Root 節點（0 個父節點）會被保留，但產生警告。 | 單樹 | warning |
| R9 | 每個 `SubTree` 節點的 `treeRef` 符合文件中某棵樹的 `name`。 | 文件 | error |
| R10 | 跨樹的子樹參照圖不含循環（不可有 `T → T`、`A → B → A`，也不可有更長的循環）。 | 文件 | error |

單樹規則（R1–R8）對 `document.trees` 中的每個 `BTTreeDef` 分別評估。文件規則（R9、R10）對整份文件評估一次。

**在 v2 中，孤立節點是正式支援的狀態**（沿用自 v1）。刪除非 Root 節點時，其原本的子節點會成為孤立節點（SPEC 成功標準 2）。R8 回報這些節點，讓使用者知道它們存在。清理操作（批次刪除孤立節點）仍不在範圍內。

**每個問題都帶有 `treeId`**，用來識別問題來自哪一棵樹。使用者點擊問題時，編輯器的驗證面板可以依此切換到正確的分頁。文件範圍規則的歸屬如下：
- R9 的問題屬於包含出錯 SubTree 節點的那棵樹。
- R10 的問題屬於循環中的第一棵樹（DFS 的起點；完整的循環路徑寫在訊息中）。

### 5.1 驗證器不負責的事項

- 樹*行為*的語意正確性（例如「這個 Fallback 沒有任何可能成功的 Action 子節點」）。驗證器只檢查結構。
- 各類型專屬的屬性驗證（`properties` 目前會被忽略）。

## 6. 載入時（schema）錯誤與按需（驗證）錯誤

| 類別 | 偵測位置 | 使用者體驗 |
|---|---|---|
| **Schema 錯誤**：JSON 格式錯誤、型別錯誤、缺少必填欄位、未知欄位、無效的 `kind`、重複的 `id`、重複的樹 `name`、失效的參照（`parentId`／`childId`／`rootId` 找不到對應節點，或 `mainTreeId` 找不到對應的樹） | 載入時，由 zod 偵測 | 檔案無法開啟。toast／面板顯示 zod 路徑（例如 `trees[1].nodes[3].kind: "Unknown" is not a valid NodeKind`）。 |
| **結構錯誤**（§5 規則） | 按需，由驗證器偵測 | 檔案可以開啟。驗證面板列出問題。每個問題都可以點擊，點擊後選取造成問題的節點。 |

這樣區分的原因是：使用者在除錯不合法的樹時，需要*看到*它才能修正。如果只因為 Decorator 有兩個子節點就默默拒絕載入，對使用者很不友善。

## 7. 完整範例

一份包含兩棵樹的文件。主樹 `"Patrol"` 執行一個參照 `"Pickup"` 的 SubTree；`"Pickup"` 就是先前的單樹範例，包裝成一個樹定義。

```json
{
  "version": 2,
  "mainTreeId": "tree-patrol",
  "trees": [
    {
      "id": "tree-patrol",
      "name": "Patrol",
      "rootId": "p-root",
      "nodes": [
        {
          "id": "p-root",
          "kind": "Root",
          "name": "Root",
          "position": { "x": 400, "y": 80 },
          "properties": {}
        },
        {
          "id": "p-seq",
          "kind": "Sequence",
          "name": "Patrol loop",
          "position": { "x": 400, "y": 200 },
          "properties": {}
        },
        {
          "id": "p-walk",
          "kind": "Action",
          "name": "Walk waypoint",
          "position": { "x": 280, "y": 320 },
          "properties": {}
        },
        {
          "id": "p-pickup",
          "kind": "SubTree",
          "name": "Pickup",
          "position": { "x": 520, "y": 320 },
          "properties": {},
          "treeRef": "Pickup"
        }
      ],
      "connections": [
        { "id": "pc1", "parentId": "p-root", "childId": "p-seq",    "order": 0 },
        { "id": "pc2", "parentId": "p-seq",  "childId": "p-walk",   "order": 0 },
        { "id": "pc3", "parentId": "p-seq",  "childId": "p-pickup", "order": 1 }
      ]
    },
    {
      "id": "tree-pickup",
      "name": "Pickup",
      "rootId": "u-root",
      "nodes": [
        {
          "id": "u-root",
          "kind": "Root",
          "name": "Root",
          "position": { "x": 400, "y": 80 },
          "properties": {}
        },
        {
          "id": "u-seq",
          "kind": "Sequence",
          "name": "Pick up object",
          "position": { "x": 400, "y": 200 },
          "properties": {}
        },
        {
          "id": "u-move",
          "kind": "Action",
          "name": "Move to target",
          "position": { "x": 240, "y": 320 },
          "properties": {}
        },
        {
          "id": "u-sees",
          "kind": "Condition",
          "name": "Sees target",
          "position": { "x": 400, "y": 320 },
          "properties": {}
        },
        {
          "id": "u-grab",
          "kind": "Action",
          "name": "Grab target",
          "position": { "x": 560, "y": 320 },
          "properties": {}
        }
      ],
      "connections": [
        { "id": "uc1", "parentId": "u-root", "childId": "u-seq",  "order": 0 },
        { "id": "uc2", "parentId": "u-seq",  "childId": "u-move", "order": 0 },
        { "id": "uc3", "parentId": "u-seq",  "childId": "u-sees", "order": 1 },
        { "id": "uc4", "parentId": "u-seq",  "childId": "u-grab", "order": 2 }
      ]
    }
  ]
}
```

## 8. 版本政策

- 目前版本是 `2`。寫入端一律輸出 `2`；載入器接受 `1`（自動遷移）與 `2`（直接驗證）。其他任何 `version` 值都會被拒絕，並顯示明確的「不支援的格式版本」錯誤。
- **在同一個固定版本內，不允許任何新增式變更**（新的選用欄位、新的節點類型），即使它們向後相容也一樣。這類變更必須提升版本。讓每個版本保持封閉，可以避免無聲的相容性意外。
- **破壞性變更**（欄位改名、移除欄位、語意改變）會提升 `version`，而且工具會提供遷移路徑。v1 → v2 是第一個這樣的遷移。

### 8.1 v1 → v2 遷移

載入器看到 `version: 1` 時自動觸發。頂層的單一樹被包裝成一個 `BTTreeDef`，放進只有一個元素的 `BTDocument` 中。

| v1 輸入 | v2 輸出 |
|---|---|
| `version: 1` | `version: 2` |
| 頂層的 `rootId, nodes, connections` | 一棵擁有相同 `rootId, nodes, connections` 的樹 |
| （沒有名稱的概念） | 樹的 `name` 預設為 `"Main"` |
| （沒有文件 id） | 新的 `mainTreeId`（UUIDv4），與包裝樹的 `id` 相同 |

節點的 `id` 完全保留。包裝樹得到一個新的 UUIDv4 `id`。遷移後，儲存會產生 v2 檔案，磁碟上原本的 v1 檔案不會被修改。因此，重新儲存一個未修改的 v1 檔案，會產生*新的*檔案結構（v2），而不是逐位元組相同的 v1 副本。

逐位元組相同的「儲存 → 載入 → 儲存」不變條件（§4.1）*在 v2 內*成立：任何能順利載入的 v2 檔案，往返後都會逐位元組相同。只有 v1 → v2 的轉換會跨越格式邊界。

## 9. 附錄：TypeScript 對應定義

正式的型別定義位於 `src/core/model/`，必須與本文件保持同步。以下草稿不具規範性：本 Markdown 文件是事實來源，`.ts` 檔案是它的實作。

```ts
export const NODE_KINDS = [
  'Root', 'Sequence', 'Fallback', 'Parallel',
  'Decorator', 'Action', 'Condition', 'Group', 'SubTree',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface BTNode {
  id: string;
  kind: NodeKind;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  // `kind === 'SubTree'` 時必填（且不可為空）；其他類型禁止使用。
  treeRef?: string;
}

export interface BTConnection {
  id: string;
  parentId: string;
  childId: string;
  order: number;
}

export interface BTTreeDef {
  id: string;
  name: string;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}

export interface BTDocument {
  version: 2;
  mainTreeId: string;
  trees: BTTreeDef[];
}

// v1（舊版）：只為載入時的遷移路徑而保留。
export interface BehaviorTree {
  version: 1;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}
```
