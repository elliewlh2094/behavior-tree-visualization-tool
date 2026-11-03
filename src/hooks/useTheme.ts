import { useEffect } from 'react';
import { useResolvedTheme, useSystemTheme } from './useResolvedTheme';

function applyDarkClass(resolved: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

// 編輯器端的 <html> `dark` class 擁有者。讀取解析後的偏好，讓 'system' 模式
// 透過 matchMedia 訂閱跟隨作業系統主題的變化，而 Settings 中明確選擇的
// 淺色／暗色會覆蓋作業系統設定。由 EditorRoute 掛載，讓編輯器（而且只有
// 編輯器）遵循儲存的主題。
export function useTheme(): void {
  const resolved = useResolvedTheme();
  useEffect(() => applyDarkClass(resolved), [resolved]);
}

// 登陸頁端的 `dark` class 擁有者。只跟隨作業系統／瀏覽器：登陸頁沒有主題
// 控制項，所以刻意忽略儲存的編輯器偏好。回傳解析後的系統主題，
// 讓呼叫端可以挑選對應的素材（例如淺色／暗色標誌）。
export function useSystemThemeClass(): 'light' | 'dark' {
  const system = useSystemTheme();
  useEffect(() => applyDarkClass(system), [system]);
  return system;
}
