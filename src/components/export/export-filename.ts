// 除非名稱已經以小寫的 `.png` 結尾，否則附加 `.png`。這個檢查刻意
// 區分大小寫（依 v1.9 規格 §106）：`MyTree.PNG` 會變成 `MyTree.PNG.png`，
// 讓下載檔一定帶有標準的小寫副檔名。拒絕空白名稱的邏輯在對話框中
// （Export 按鈕維持停用）。
export function ensurePngExtension(name: string): string {
  return name.endsWith('.png') ? name : `${name}.png`;
}
