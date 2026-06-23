import { useEffect } from 'react';

// FR9 unsaved-changes guard. While `enabled` is true, a tab close / reload /
// navigation away triggers the browser's native "Leave site? Changes you made
// may not be saved." confirmation. When `enabled` is false the listener is
// detached entirely, so a clean document never adds navigation friction.
//
// The handler must both `preventDefault()` (modern spec) and set
// `returnValue` (legacy Chrome/Firefox) for the prompt to appear; the prompt
// text itself is fixed by the browser and cannot be customized.
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
