import { useCallback } from 'react';
import { deserialize } from '../core/serialization/deserialize';
import { useBTStore } from '../store/bt-store';
import type { BTTemplate } from '../templates';

/**
 * 回傳一個回呼，把打包好的範本載入編輯器，並重用開啟檔案的路徑：
 * `deserialize → setDocument → setFileName`。`setDocument` 會重設 dirty
 * 的基準，所以剛載入的範本是未修改狀態；檔名在之後才設定，
 * 因為 `setDocument` 會把它重設為 'Untitled.json'。
 */
export function useLoadTemplate(): (template: BTTemplate) => void {
  return useCallback((template: BTTemplate) => {
    const result = deserialize(template.json);
    if (!result.ok) {
      // 範本是打包進套件的，並由單元測試驗證；這裡發生失敗，代表建置時的
      // 範本撰寫錯誤，而不是使用者會遇到的情況。
      throw new Error(`Invalid bundled template "${template.id}"`);
    }
    const { setDocument, setFileName } = useBTStore.getState();
    setDocument(result.document);
    setFileName(`${template.name}.json`);
  }, []);
}
