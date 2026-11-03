import { useCallback, useState } from 'react';
import { useBTStore } from '../store/bt-store';
import type { DiscardCopy } from '../components/common/UnsavedChangesModal';

interface PendingDiscard {
  action: () => void;
  copy: DiscardCopy;
}

export interface DiscardGuard {
  /** 待處理的確認；沒有任何動作等待確認時為 null。 */
  pending: PendingDiscard | null;
  /**
   * 執行 `action`；文件為 dirty 時，先經過未存變更對話框的守衛。
   * 文件未修改 → 立即執行（不提示）。
   */
  requestDiscard: (action: () => void, copy: DiscardCopy) => void;
  /** 確認待處理的動作（繼續執行，捨棄變更）。 */
  confirm: () => void;
  /** 取消待處理的動作（保留目前的文件）。 */
  cancel: () => void;
}

/**
 * 統一未存變更守衛（AD10）中的命令式部分：讓任何*取代文件*的編輯器內動作
 * （例如 Open）都經過與路由導航阻擋器相同的自訂對話框，而不是另外使用
 * `window.confirm`。路由阻擋器仍是宣告式的部分；這個 hook 涵蓋
 * 不屬於導航的動作。
 */
export function useDiscardGuard(): DiscardGuard {
  const [pending, setPending] = useState<PendingDiscard | null>(null);

  const requestDiscard = useCallback(
    (action: () => void, copy: DiscardCopy) => {
      if (!useBTStore.getState().dirty) {
        action();
        return;
      }
      setPending({ action, copy });
    },
    [],
  );

  return {
    pending,
    requestDiscard,
    confirm: () => {
      if (!pending) return;
      setPending(null);
      pending.action();
    },
    cancel: () => setPending(null),
  };
}
