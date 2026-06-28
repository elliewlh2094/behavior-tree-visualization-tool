import { useCallback, useState } from 'react';
import { useBTStore } from '../store/bt-store';
import type { DiscardCopy } from '../components/common/UnsavedChangesModal';

interface PendingDiscard {
  action: () => void;
  copy: DiscardCopy;
}

export interface DiscardGuard {
  /** The pending confirmation, or null when nothing is awaiting confirmation. */
  pending: PendingDiscard | null;
  /**
   * Run `action`, guarding it behind the unsaved-changes modal when the
   * document is dirty. Clean document → runs immediately (no prompt).
   */
  requestDiscard: (action: () => void, copy: DiscardCopy) => void;
  /** Confirm the pending action (proceed, discarding changes). */
  confirm: () => void;
  /** Dismiss the pending action (keep the current document). */
  cancel: () => void;
}

/**
 * Imperative half of the unified unsaved-changes guard (AD10): lets any
 * in-editor action that *replaces the document* (e.g. Open) funnel through the
 * same custom modal as the router's navigation blocker, instead of a separate
 * `window.confirm`. The router blocker stays the declarative half; this hook
 * covers actions that aren't navigations.
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
