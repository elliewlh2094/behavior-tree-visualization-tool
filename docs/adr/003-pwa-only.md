# ADR 003 — 只以 PWA 發佈（不提供原生包裝）

**日期：** 2026-04-22  
**狀態：** 已接受

## 背景

本工具需要能離線運作。安裝後，也可以選擇讓它看起來像原生應用程式。有兩大類做法：一是從靜態主機提供 PWA（Progressive Web App，漸進式網頁應用程式）；二是用原生包裝（Tauri、Electron）把網頁應用程式打包進原生外殼。

## 決策

v1 **只提供 PWA**。不提供 Tauri 或 Electron 執行檔。

## 考慮過的替代方案

| 方案 | 不採用的原因 |
|---|---|
| Electron | 發佈檔約增加 150 MB。需要各平台專屬的建置流程（程式碼簽章、macOS 公證）與自動更新基礎設施。本工具是單頁工具，沒有原生作業系統整合需求，這些成本不成比例。 |
| Tauri | 比 Electron 小，但仍需要 Rust 工具鏈、各平台建置矩陣，以及應用程式商店或直接下載的發佈管道。對 v1 而言是可觀的維運成本。 |
| 原生檔案系統 API | PWA 可用的 File System Access API（Chrome／Edge）已涵蓋主要使用情境（開啟／儲存 `.json`）。在不支援的瀏覽器上，應用程式改用標準的 `<input type="file">` 加上 `URL.createObjectURL` 下載。這對 v1 已經足夠。 |

## 影響

- `npm run build` 產生 `dist/` 資料夾，任何靜態主機（GitHub Pages、Netlify、本機 `npx serve`）都能提供服務。
- `vite-plugin-pwa` 產生 `manifest.webmanifest` 與 Workbox service worker。service worker 預先快取應用程式外殼，滿足「首次載入後可離線使用」的需求。
- 專案提供 192 px 與 512 px 的 maskable 圖示，讓安裝後的 PWA 圖示在 Android 自適應圖示與 iOS 主畫面上正確顯示。
- 如果日後使用者需要原生作業系統整合（檔案系統監看、系統匣圖示、協定處理器），Tauri 仍是首選的升級路徑，而且網頁程式碼不需要修改。
