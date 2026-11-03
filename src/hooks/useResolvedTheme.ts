import { useEffect, useState } from 'react';
import { usePreferencesStore } from '../store/preferences-store';

// 'system' 解析為目前的作業系統偏好，並持續訂閱 matchMedia 的變化，
// 讓應用程式即時跟隨作業系統的主題切換。集中在這裡，讓 useTheme
// （切換 `dark` class）與 usePreferencesSync（寫入各類型的 CSS 變數）
// 從同一個事實來源讀取。
//
// 對沒有 window.matchMedia 的環境採取防禦性處理（測試中 polyfill 載入前的
// jsdom、非常舊的瀏覽器等）：預設為淺色。
function getMql(): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.matchMedia !== 'function') return null;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  return mql ?? null;
}

// 只取作業系統／瀏覽器的主題，忽略任何使用者偏好。持續訂閱 matchMedia，
// 讓它即時跟隨作業系統的切換。登陸頁直接使用它（登陸頁沒有主題控制項）；
// useResolvedTheme 以它為基礎實作編輯器的 'system' 模式。
export function useSystemTheme(): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(() => getMql()?.matches ?? false);

  useEffect(() => {
    const mql = getMql();
    if (!mql) return;
    function onChange(e: MediaQueryListEvent): void {
      setSystemDark(e.matches);
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return systemDark ? 'dark' : 'light';
}

// 編輯器的實際主題：使用者儲存的偏好，其中 'system' 解析為即時的作業系統主題。
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = usePreferencesStore((s) => s.theme);
  const system = useSystemTheme();

  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return system;
}
