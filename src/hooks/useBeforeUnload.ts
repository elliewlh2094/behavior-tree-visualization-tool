import { useEffect } from 'react';

// FR9 未存變更守衛。`enabled` 為 true 時，關閉分頁／重新載入／離開網頁
// 會觸發瀏覽器原生的 "Leave site? Changes you made may not be saved." 確認。
// `enabled` 為 false 時，監聽器完全移除，所以未修改的文件永遠不會
// 增加導航上的阻力。
//
// 處理器必須同時呼叫 `preventDefault()`（新版規格）並設定 `returnValue`
// （舊版 Chrome／Firefox），提示才會出現；提示文字本身由瀏覽器決定，
// 無法自訂。
export function useBeforeUnload(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    function handler(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);
}
