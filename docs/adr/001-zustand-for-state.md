# ADR 001 — 以 Zustand 管理全域狀態

**日期：** 2026-04-22  
**狀態：** 已接受

## 背景

應用程式需要一個共用的狀態 store，用來保存行為樹、undo/redo 歷史紀錄、驗證結果與 UI 選取狀態。我們評估了數個方案。

## 決策

使用 **Zustand**（`zustand@^5`）作為唯一的全域狀態管理器。

## 考慮過的替代方案

| 方案 | 不採用的原因 |
|---|---|
| React Context + useReducer | 沒有內建的細粒度訂閱。任何 slice 改變時，所有 context 使用者都會重新渲染。小型應用程式可以接受；畫布上有數十個節點時，效能會下降。 |
| Redux Toolkit | 樣板程式碼多。本工具是單頁工具，沒有非同步資料擷取。在這個規模下，slice／action／selector 的固定寫法增加成本，但沒有相應的好處。 |
| MobX | MobX 的可觀察變更（observable mutation）模型與 React Flow「節點陣列不可變」的約定互相衝突。兩者混用時，必須明確串接 reaction／autorun，程式行為難以推理。 |
| Jotai（atoms） | 以 atom 為單位的細粒度適合表單狀態。但本工具有許多整棵樹的操作（undo 會對整個 `BehaviorTree` 建立快照），用 atom 處理很不順手。 |

## 影響

- store 位於 `src/store/bt-store.ts`。所有狀態變更都透過 store action 執行；元件透過 `useStore(selector)` 讀取 slice。
- undo 歷史紀錄以 `RingBuffer<BehaviorTree>`（容量 10）保存在 store 內。每個快照都是整棵樹的複製。本工具的目標樹規模是數十個節點，所以複製成本很低。
- 測試 store 邏輯不需要 React。`bt-store.ts` 匯出具型別的 action 函式，Vitest 單元測試可以直接呼叫這些函式。
