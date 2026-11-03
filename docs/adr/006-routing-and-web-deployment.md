# ADR 006 — HashRouter 路由與 GitHub Pages 網頁部署

**日期：** 2026-06-22
**狀態：** 已接受

## 背景

到 v1.10 為止，應用程式只有單一編輯器畫面，沒有路由器（`App.tsx` 以一個布林值切換 `StartScreen`），而且唯一的執行方式是在本機 clone。v1.11（`docs/SPEC-v1.11.md`）新增一個行銷風格的登陸頁，從登陸頁連到編輯器；並把應用程式發佈到公開網址，讓訪客不必購買網域，就能在瀏覽器中試用。

這帶來兩個互相關聯的決策：第一，登陸頁（`#/` 或 `/`）與編輯器（`/editor`）之間如何路由；第二，如何部署、部署在哪裡。部署目標是 **GitHub Pages 專案網站** `https://elliewlh2094.github.io/behavior-tree-visualization-tool/`。也就是說，應用程式位於**子路徑**下，而不是網域根目錄。Pages 也沒有伺服器端改寫功能，所以若不處理，直接連到用戶端路由的深層連結會得到 404。此外，應用程式是 PWA（ADR 003），所以路由不可以破壞 service worker。

## 決策

1. **路由：** 採用 `react-router-dom` 的 **HashRouter**：`#/` 為登陸頁，`#/editor` 為編輯器。這是專案第一個路由相依套件。
2. **部署：** 使用 **GitHub Pages**。推送到 `main` 時，由 GitHub Actions workflow 自動部署（`configure-pages` → `upload-pages-artifact` → `deploy-pages`）。
3. **base：** `vite.config.ts` 在 `build` 時把 `base` 設為 `/behavior-tree-visualization-tool/`，在 `dev` 時設為 `/`。

## 考慮過的替代方案

| 方案 | 不採用的原因 |
|---|---|
| **BrowserRouter**（乾淨的 `/editor` 網址） | 在 Pages 專案網站上，service worker 安裝之前，直接載入或重新整理 `/.../editor` 會得到 404（沒有伺服器改寫）。標準解法是用 `404.html` 重新導向到 `index.html`，但這是脆弱的權宜做法。HashRouter 完全避開這個問題：hash 不會送到伺服器，也不會送到 service worker。 |
| **不使用路由器**（保留布林狀態機，在狀態中切換登陸頁與編輯器） | 沒有可分享的編輯器網址，登陸頁與編輯器之間無法使用瀏覽器的上一頁／下一頁，也無法直接連結到登陸頁。路由器的成本很小，卻提供了真正的導航語意。 |
| **Netlify／Vercel** 部署 | 兩者都支援 SPA 改寫（適合 BrowserRouter）與根路徑部署，但需要額外的外部帳號與服務。GitHub Pages 不需要新帳號（儲存庫已在 GitHub 上），也符合「不購買網域」的目標。如果日後需要乾淨的網址，再重新評估。 |
| **`base: './'`（完全相對路徑）** | 對靜態資源有效，但與部分 Vite／PWA 的路徑解析互動不佳。明確的子路徑 `base` 較清楚，而且 `start_url`／`scope: '.'` 本來就以此為前提。 |

## 影響

- **靜態資源路徑必須能感知 base。** 在子路徑 base 下，絕對路徑的 `/asset` 參照（`index.html` 的圖示、`Toolbar`／`StartScreen` 的標誌）會得到 404。這些參照改用 `import.meta.env.BASE_URL`（或靜態 `import`）。這是 v1.11 風險最高的項目：如果遺漏，線上的標誌與 PWA 圖示會在沒有任何錯誤訊息的情況下失效。
- **PWA 不受影響。** service worker 看不到 hash 片段，所以 service worker 的路由與預先快取不變。`manifest.start_url`／`scope` 維持 `'.'`（相對路徑），在子路徑下已能正確解析。
- **`npm run dev` 維持在 `/`**（base 只在建置時生效），所以本機開發流程不變。
- **網址帶有 `#`**（`…/#/editor`）。這是為了取得免費、無網域、不會 404 的部署而接受的取捨。如果日後需要乾淨的網址，升級路徑是 BrowserRouter 加上支援 SPA 改寫的主機（Netlify／Vercel），或 Pages 的 `404.html` 重新導向。路由程式碼的改動很小（替換 Router 元件即可）。
- **推送到 `main` 時自動部署。** 包含 `react-router-dom` 的 lockfile 必須提交，CI 的 `npm ci` 才會成功。
