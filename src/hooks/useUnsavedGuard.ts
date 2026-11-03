import { createContext, useContext } from 'react';
import type { DiscardCopy } from '../components/common/UnsavedChangesModal';

export type RequestDiscard = (action: () => void, copy: DiscardCopy) => void;

// 預設值：沒有掛載編輯器（沒有可用的守衛）→ 直接執行動作。
// EditorRoute 以真正會判斷 dirty 的守衛覆蓋這個預設值。
const UnsavedGuardContext = createContext<RequestDiscard>((action) => action());

export const UnsavedGuardProvider = UnsavedGuardContext.Provider;

/**
 * 取得統一的未存變更守衛。包住一個會取代文件的動作，讓它在有未存變更時
 * （透過共用對話框）先確認：
 * `requestDiscard(() => openFile(), OPEN_DISCARD_COPY)`。
 */
export function useUnsavedGuard(): RequestDiscard {
  return useContext(UnsavedGuardContext);
}
