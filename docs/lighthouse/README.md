# Lighthouse 稽核

Lighthouse 稽核是每次出貨時的回歸檢查，檢查項目包括無障礙（A11y）、最佳做法（Best Practices）、SEO，以及登陸頁的效能（Performance）。每個 `vX.Y` 版本結束時執行一次，與 `npm run typecheck` 和各測試套件一起執行。

稽核的產出是四組 `.html` + `.json` 報告，存放在這個資料夾中。請與上一版的報告比較。A11y 或 Best Practices 若有任何退步，在調查清楚之前不可出貨。

## 稽核的對象

| 變體                          | 裝置類型    | Lighthouse 模式 | 涵蓋內容                                     |
| ----------------------------- | ----------- | --------------- | -------------------------------------------- |
| `audit-light`、`audit-dark`   | desktop     | navigation      | 冷啟動載入的登陸頁 `#/`（完整效能追蹤）      |
| `editor-audit-light`、`-dark` | mobile      | snapshot        | 直接載入 `#/editor` 後的編輯器畫面           |

v1.10 以前，第一組稽核的對象是 StartScreen；v1.11 移除 StartScreen 後，改為登陸頁。與 v1.10 的報告比較時，請注意稽核對象已經不同。

編輯器使用 **snapshot** 模式。v1.10 以前，編輯器無法直接連結，必須先點擊越過 StartScreen。v1.11 起雖然可以直接載入 `#/editor`，但為了與既有基準比較，仍維持 snapshot 模式。snapshot 模式在不重新導航的情況下稽核頁面目前的渲染狀態，因此完全跳過 Performance。所以每份編輯器報告都顯示 `Perf 0`：這代表「未量測」，不是退步。

## 前置條件

- Node 20 以上版本，以及系統安裝的 Chrome（Linux 上為 `/usr/bin/google-chrome`）。`chrome-launcher` 會自動找到它。
- `package.json` 中宣告的開發相依套件：`lighthouse@13`、`puppeteer-core@23`、`chrome-launcher`。執行 `npm install` 即可。

## 執行稽核

```bash
# 1. 建置正式版套件
npm run build

# 2. 啟動 vite preview（保持執行）；應用程式位於 http://localhost:4173/behavior-tree-visualization-tool/
npm run preview &

# 3. 執行四項稽核並存檔報告
node scripts/lighthouse-audit.mjs v1.5

# 4. 停止 preview
pkill -f "vite preview"
```

把版本代號作為腳本唯一的參數傳入（`v1.5`、`v2.0` 等）。報告會存到 `docs/lighthouse/<slug>-{audit,editor-audit}-{light,dark}.report.{html,json}`。腳本結束時，會為每個變體印出一行分數，例如 `[ok] audit-light: Perf 100 / A11y 100 / BP 100 / SEO 83`。

如果任何分數比上一版退步，請先修正問題，再提交存檔（見接下來的兩節）。

## 閱讀報告

每個 `*.report.json` 都是一個 Lighthouse Result（LHR）物件。有三個部分值得了解：

- `categories.<id>.score`：每個類別的分數，範圍 0–1（`performance`、`accessibility`、`best-practices`、`seo`）。
- `categories.<id>.auditRefs[]`：對該類別有貢獻的稽核 ID 清單。
- `audits[<id>]`：每項稽核的 `{ score, title, description, details }`。稽核失敗時，`details.items[].node.snippet`（或 `.selector`）指向造成問題的 DOM 元素。

列出一份報告中所有失敗的稽核：

```bash
node -e "
  const r = require('./docs/lighthouse/v1.10-editor-audit-light.report.json');
  for (const cat of Object.values(r.categories))
    for (const ref of cat.auditRefs) {
      const a = r.audits[ref.id];
      if (a.score !== null && a.score < 1)
        console.log(cat.id, ref.id, a.score, '-', a.title);
    }
"
```

這段指令印出個別分數低於 1 的每項稽核，包括不影響類別分數的已知低權重項目。例如，`seo meta-description`、`seo robots-txt`、`agentic-browsing llms-txt` 出現在每份編輯器報告中，它們說明了 SEO 基準分數為 67 的原因。真正要看的是相對於上一版*新出現*的項目：把同一段指令改指向 `v(X.Y-1)-editor-audit-light.report.json`，再比較兩份輸出。

要查看*哪個*元素觸發失敗，請檢查同一項稽核的 `details.items`：

```bash
node -e "
  const r = require('./docs/lighthouse/v1.10-editor-audit-light.report.json');
  const a = r.audits['aria-required-children'];
  for (const item of (a.details?.items ?? []))
    console.log(item.node?.snippet || item.node?.selector || item);
"
```

如果要看圖形化介面，直接在瀏覽器中開啟 `.report.html` 檔案。內容相同，而且每項稽核都附有連到 MDN／web.dev 的「Learn more」連結。

## 從失敗追到修正（實例：v1.4）

v1.4 的第一次執行中，編輯器的 A11y 從 100 退步到 95。追查過程如下：

1. **找出失敗項目。** 上方的列表指令指出 `accessibility aria-required-children`。
2. **找出元素。** 該稽核的 `details.items[0].node.snippet` 是 TabBar 的 `<div role="tablist" aria-label="Trees">`。標題是：*「Elements with an ARIA `[role]` that require children to contain a specific `[role]` are missing some or all of those required children.」*
3. **追到原始碼。** 以 `grep` 搜尋 `role="tablist"`，找到 `src/components/tab-bar/TabBar.tsx`。外層容器有這個 role，但實際的 `role="tab"` 按鈕放在一個 `overflow-x-auto` 的捲動包裝 `<div>` 內。axe-core 只檢查直接子元素，所以找不到分頁。
4. **修正。** 把 `role="tablist"` 與 `aria-label="Trees"` 移到直接包含分頁按鈕的捲動包裝元素上。`+` 動作按鈕與確認對話框留在 tablist 之外，作為同層元素（它們不是分頁）。
5. **驗證。** 重新執行稽核，A11y 回到 100。Commit `e114720`。

心得：稽核失敗時，沿著「snippet → 元素 → role／結構」這條線追查。修正的對象很少是稽核本身，而是稽核揭露出來的結構假設。

## 與上一版比較

把新報告與上一版報告整理成差異表，放進出貨的 commit 訊息中：

| 稽核              | 模式             | v(上一版)（P/A/BP/SEO） | v(新版)（P/A/BP/SEO） | 差異    |
| ----------------- | ---------------- | ----------------------- | --------------------- | ------- |
| StartScreen 淺色  | desktop nav      | 97 / 100 / 100 / 83     | 100 / 100 / 100 / 83  | Perf +3 |
| StartScreen 暗色  | desktop nav      | 97 / 100 / 100 / 83     | 100 / 100 / 100 / 83  | Perf +3 |
| 編輯器 淺色       | mobile snapshot  | 0 / 100 / 100 / 67      | 0 / 100 / 100 / 67    | 持平    |
| 編輯器 暗色       | mobile snapshot  | 0 / 100 / 100 / 67      | 0 / 100 / 100 / 67    | 持平    |

A11y 與 Best Practices 的退步視為阻擋出貨的問題。在沒有 snapshot 的 navigation 執行中，Performance ±2 屬於正常雜訊；下降幅度更大時才需要調查。v1.1 到 v1.10，SEO 穩定在 83（StartScreen）與 67（編輯器）。兩者都受限於缺少可供爬取的公開描述，我們不打算追求提高。v1.11 的稽核對象與網址都已改變，所以 SEO 基準需要以 v1.11 的報告重新建立。

## 存檔慣例

- 檔名：`vX.Y-{audit,editor-audit}-{light,dark}.report.{html,json}`。
- `.html` 與 `.json` 都要提交。`.html` 是供人閱讀的產出；`.json` 是上方追查失敗的指令所讀取的資料。
- 把這八個檔案放進該版本的出貨 commit。v1.4 範例：commit `7316bd6`。

## 注意事項

- **登陸頁與編輯器以不同方式指定主題（AD8）。**
  - 登陸頁只跟隨作業系統，會忽略 localStorage。腳本以 `page.emulateMediaFeatures` 模擬 `prefers-color-scheme`。
  - 編輯器讀取儲存的偏好。腳本寫入 `localStorage['bt-visualizer-preferences'] = '{"state":{"theme":"dark"},"version":2}'`，讓 `index.html` 中的 FOUC 腳本在首次繪製時套用該主題。
  - Lighthouse 的 navigation 稽核預設會清除儲存空間；腳本傳入 `disableStorageReset: true`，讓預先寫入的值在稽核自身的導航過程中保留下來。
- **進入編輯器時必須重新載入。** 從登陸頁 `goto` 到 `#/editor` 只改變 hash，屬於同一份文件內的導航；偏好 store 會沿用寫入 localStorage 之前 hydrate 的值，導致淺色／暗色對調。腳本的 `openEditor()` 因此在導航後執行 `reload`。
- **檢查截圖，確認主題正確。** 分數無法反映主題是否套用成功。navigation 報告的截圖在 `audits['final-screenshot']`，snapshot 報告的截圖在 `fullPageScreenshot`。
- **snapshot 模式會跳過 Performance。** 編輯器報告一律顯示 `Perf 0`。這是 API 的行為，不是退步。
- **編輯器使用 mobile 裝置類型，與 v1.3 基準一致。** 不要改成 desktop，除非先以新的上一版執行結果重新建立編輯器分數基準；否則無法判斷退步或進步的原因。
