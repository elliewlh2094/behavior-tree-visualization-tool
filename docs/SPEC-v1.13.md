# 規格：Behavior Tree Visualization Tool — v1.13「緊密排版」

> Roadmap 條目：`docs/tasks/roadmap.md` §v1.13。任務拆解：`docs/tasks/v1.13-todo.md`。決策紀錄：`docs/adr/012-compact-layout-mode.md`。
> 2026-11-19 新增，來源是使用者參考 Colledanchise & Ögren《Behavior Trees in Robotics and AI》（2018）圖 7.8 提出的排版需求。

## 目標

展示大型行為樹時，讓 Layout 按鈕排出接近教科書圖 7.8 的窄樹。現有排版讓每個葉節點獨佔一欄，樹的寬度隨葉節點數量增加。

**使用者：** 在畫布上展示或匯出大型行為樹的人。

**成功的樣貌：**
- 同一棵大型樹在 Compact 模式下明顯變窄，節點不重疊，連線仍然清楚。
- Default 模式的排版結果與 v1.12 相同。

## 行為

- **偏好設定：** Settings 面板新增 "Auto Layout" 區塊，選項為 Default 與 Compact，預設 Default。偏好存在 localStorage，不參與 undo，JSON 格式不變。
- **生效時機：** 切換偏好不移動任何節點。使用者下次按 Layout 時才依所選模式排版；這次排版可以 undo。
- **Compact 模式：**
  - 兄弟子樹依每一列的左右輪廓緊貼排列，水平間距 25 px（1 格）。深的子樹可以伸到淺的兄弟子樹下方。
  - 兄弟子樹以「由左向右、由右向左各放置一次後取平均」定位，樹保持鏡像對稱。
  - 每個節點以實際寬度參與計算，所以 Decorator 標籤不與相鄰節點重疊。
  - 列距維持 50 px。
- **共用行為：** 孤立節點列、Root 固定位置、格線貼齊與 v1.12 相同。

## 指令

```
Dev:        npm run dev
Build:      npm run build        # 包含 tsc -b
Lint:       npm run lint
Unit tests: npx vitest run
E2E tests:  npm run test:e2e     # 讀 dist/，先執行 build
```

## 邊界

- **一律執行：** 提交前執行 lint、build、單元測試、e2e。
- **不做：**
  - 縮小 Action／Condition 節點。
  - 切換偏好時自動重新排版。
  - 第三種模式或自訂間距的數值輸入。
  - 把排版模式存進文件。
