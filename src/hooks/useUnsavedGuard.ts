import { createContext, useContext } from 'react';
import type { DiscardCopy } from '../components/common/UnsavedChangesModal';

export type RequestDiscard = (action: () => void, copy: DiscardCopy) => void;

// Default: no editor mounted (no guard available) → run the action directly.
// EditorRoute overrides this with the real, dirty-aware guard.
const UnsavedGuardContext = createContext<RequestDiscard>((action) => action());

export const UnsavedGuardProvider = UnsavedGuardContext.Provider;

/**
 * Access the unified unsaved-changes guard. Wrap a document-replacing action so
 * it confirms (via the shared modal) when there are unsaved changes:
 * `requestDiscard(() => openFile(), OPEN_DISCARD_COPY)`.
 */
export function useUnsavedGuard(): RequestDiscard {
  return useContext(UnsavedGuardContext);
}
