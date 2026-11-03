# ADR 005 — 多樹文件模型與檔案格式 v2

**日期：** 2026-04-29
**狀態：** 已接受

## 背景

v1.0–v1.3 以單一 `BehaviorTree`（`version: 1`）表示一棵行為樹。v1.4 引入 SubTree 參照：這是一種以名稱指向另一個樹定義的節點類型，無法用單樹模型表達。因此需要兩項結構變更：

1. 持久化的單位必須能保存 N 個樹定義，以及一個指定的「主要」進入點。
2. SubTree 驗證（R9 不可有失效參照、R10 不可有循環）在跨樹參照圖上執行，而不是在單一樹內執行。

這是第一個同時改動資料模型與持久化檔案格式的版本，而不只是改動 UI。先前的架構決策（AD1–AD3）只涉及 UI 或排版；這個決策改寫了每一次儲存與載入都要經過的契約。

## 決策

把持久化單位從 `BehaviorTree` 提升為新的 `BTDocument`：

```ts
interface BTDocument {
  version: 2;
  mainTreeId: string;
  trees: BTTreeDef[];
}
interface BTTreeDef {
  id: string;
  name: string;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}
```

檔案格式版本升為 2。開啟 v1 檔案時自動遷移：單一樹被包成只有一個元素的文件，預設名稱為 `"Main"`。所有儲存都輸出 v2。

`SubTree` 成為第 9 種 `NodeKind`。`BTNode` 新增選用欄位 `treeRef?: string`，只在 `kind === 'SubTree'` 時有意義。參照以**樹名稱**為依據，而不是樹的 id。原因有二：這符合 Groot2／BehaviorTree.CPP 的慣例，作者以易讀的名稱思考子樹；而且遷移時重新產生 id 也不會影響參照。

## 考慮過的替代方案

| 方案 | 不採用的原因 |
|---|---|
| 保留 `BehaviorTree`，在 v2 新增頂層欄位 `subtrees: Record<string, BehaviorTree>` | 兩層結構（一棵特權樹加上一個子樹字典）讓「把子樹提升為主樹」很難處理，而且 SubTree 解析會有兩條程式路徑。扁平的 `trees: BTTreeDef[]` 加上 `mainTreeId` 只需要一條程式路徑。 |
| 以參照方式內嵌子樹（沒有獨立的樹定義） | 會失去「改一次、所有地方生效」的特性，而這正是 SubTree 存在的理由。SubTree 的重點就是共用定義。 |
| 每棵樹一個檔案（專案模型） | 變動幅度更大，隱含專案／資料夾的概念，也會失去工具目前擁有的單檔可攜性。在 v2.0 討論可重用範本時再重新考慮。 |
| 在 `BTNode` 上使用可辨識聯合型別（`BasicNode \| SubTreeNode`，變體上的 `treeRef` 為必填） | 型別更安全，但會波及處理 `BehaviorTree` 的程式碼中 10 個檔案、45 個型別位置。依 v1.4 計畫先出貨選用的 `treeRef?: string`；等情況穩定後，再於日後的整理中收緊為可辨識聯合型別。 |
| 以 `treeId` 而非 `name` 參照子樹 | 重新命名時較穩定，但破壞了概念模型：作者以名稱思考，檔案也由人閱讀，而 `treeId` 只是不透明的 UUID 雜訊。重新命名的傳播（T11）負責處理這個成本。 |

## 影響

- **讀取向後相容，寫入不向後相容。** v1 檔案在 `deserialize` 中透過自動遷移載入。儲存只輸出 v2，使用者無法把檔案存回 v1。這是刻意的設計：維護 v1 寫入路徑會讓序列化的介面加倍，好處卻很少。這一點記錄在 `docs/bt-json-format.md`（將於 T4 更新）。
- **既有的記憶體內操作以單一 `BTTreeDef` 為對象。** `addNode`、`connect`、`moveNode` 等操作繼續作用於使用中的樹。store 新增 `activeTreeId`（T6），用來選擇畫布要讀取哪一棵樹。
- **驗證分為兩層。** 規則 R1–R8 仍以單樹為單位。新增的 R9（`treeRef` 必須參照存在的樹）與 R10（不可有循環的子樹參照）作用於整份文件。`validate()` 的簽章改為接受 `BTDocument`（T5）。
- **`mainTreeId` 是進入點，不一定是 `trees[0]`。** 這讓陣列次序與語意脫鉤：T11 重新排列分頁時，不會改變哪一棵樹是「主樹」。主樹會有一個不顯眼的 UI 標記（T9）。
- **分階段遷移 `BehaviorTree`。** T1 維持 `BehaviorTree` 不變，只新增文件型別。T6 讓 store 改為保存 `BTDocument`，並開始從內部呼叫點移除 `BehaviorTree`。這個型別可能以已棄用別名的形式再保留一個版本，之後完全移除；確切做法在 T6 完成時決定。
- **保留往返（round-trip）的確定性。** 在每個 `BTTreeDef` 內，v1 的固定鍵順序規則（`docs/bt-json-format.md` §4）原樣沿用。新的文件外層本身也使用固定鍵順序：`version`、`mainTreeId`、`trees`。
