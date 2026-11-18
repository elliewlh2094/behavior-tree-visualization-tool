# 規格：Behavior Tree Visualization Tool — v1.12「教科書式控制節點」

> Roadmap 條目：`docs/tasks/roadmap.md` §v1.12。任務拆解：`docs/tasks/v1.12-todo.md`。決策紀錄：`docs/adr/011-control-node-symbol-style.md`。
> 2026-11-19 新增，來源是使用者重讀 Colledanchise & Ögren《Behavior Trees in Robotics and AI》（2018）後提出的樣式更新。

## 目標

讓讀者一眼區分流程控制節點與執行節點。書中把控制節點畫成小方框，方框內只有符號；v1.12 在畫布與匯出 PNG 上採用相同的畫法。

**使用者：** 主要是匯出圖片的讀者（論文、報告、簡報），次要是在畫布上編輯的使用者。

**成功的樣貌：**
- 匯出圖中的控制節點符合教科書的畫法。
- 按下 Layout 後，小節點的中心位於子節點的中央。
- 舊檔案載入後不遺失資料。

## 外形

| 種類 | v1.12 外形 | 名稱 |
|---|---|---|
| Sequence | 50 × 50 px 方框，內含 → | 不顯示 |
| Fallback | 50 × 50 px 方框，內含 ? | 不顯示 |
| Parallel | 50 × 50 px 方框，內含 ⇉ | 不顯示 |
| Decorator | 50 × 50 px 菱形，內含 δ | 顯示在菱形右側（最多 2 行，超過時截斷） |
| Root、Action、Condition、Group、SubTree | 不變（150 × 75 px 圓角矩形） | 不變 |

- 顏色沿用各種類的色彩系列（Settings 面板）。
- Decorator 的連線接在菱形中心。標籤屬於節點外框，所以匯出取景會包含標籤。
- 選取外框與搜尋外框沿用現有樣式，匯出時隱藏。

## 行為

- **名稱：** `name` 欄位保留在 JSON 中，Properties 面板仍可編輯。檔案格式不變。
- **排版：** 父節點以「子節點中心線的平均值」置中，不再假設所有節點等寬。
- **搜尋：** 不比對 Sequence、Fallback、Parallel 的名稱，因為畫布上看不到這些名稱。
- **舊檔案：** 不自動遷移座標。控制節點會依舊座標畫在左上角，按 Layout 即可重新對齊。

## 指令

```
Dev:        npm run dev
Build:      npm run build        # 包含 tsc -b
Lint:       npm run lint
Unit tests: npx vitest run
E2E tests:  npm run test:e2e
```

## 邊界

- **一律執行：** 提交前執行 lint、build、單元測試、e2e。
- **不做：**
  - 新舊樣式切換開關。
  - Decorator 子類型（例如 ¬ 代表 Inverter）。
  - 用 tooltip 顯示控制節點名稱。
  - 移除控制節點的名稱編輯：已列入 roadmap Deferred，留待大版本處理。
