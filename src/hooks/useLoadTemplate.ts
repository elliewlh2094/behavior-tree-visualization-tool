import { useCallback } from 'react';
import { deserialize } from '../core/serialization/deserialize';
import { useBTStore } from '../store/bt-store';
import type { BTTemplate } from '../templates';

/**
 * Returns a callback that loads a bundled template into the editor, reusing the
 * file-open path: `deserialize → setDocument → setFileName`. `setDocument`
 * resets the dirty baseline, so a freshly loaded template starts clean; the
 * file name is set afterwards because `setDocument` resets it to 'Untitled.json'.
 */
export function useLoadTemplate(): (template: BTTemplate) => void {
  return useCallback((template: BTTemplate) => {
    const result = deserialize(template.json);
    if (!result.ok) {
      // Templates are bundled and validated by unit tests; a failure here is a
      // build-time authoring error, not a user-facing condition.
      throw new Error(`Invalid bundled template "${template.id}"`);
    }
    const { setDocument, setFileName } = useBTStore.getState();
    setDocument(result.document);
    setFileName(`${template.name}.json`);
  }, []);
}
