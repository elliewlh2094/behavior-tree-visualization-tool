import { useCallback, useRef, useState } from 'react';
import { useBTStore } from '../store/bt-store';
import { deserialize, type DeserializeError } from '../core/serialization/deserialize';

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });
}

function formatError(err: DeserializeError): string {
  if (err.kind === 'parse') return err.message;
  const first = err.issues[0];
  if (!first) return 'Invalid tree file.';
  const path = first.path.length > 0 ? first.path.join('.') : '(root)';
  const more = err.issues.length > 1 ? ` (+${err.issues.length - 1} more)` : '';
  return `${path}: ${first.message}${more}`;
}

export interface UseFileOpen {
  fileInputRef: React.RefObject<HTMLInputElement>;
  error: string | null;
  clearError: () => void;
  triggerOpen: () => void;
  handleFileSelected: (event: React.ChangeEvent<HTMLInputElement>) => Promise<boolean>;
}

export interface UseFileOpenOptions {
  onSuccess?: () => void;
}

export function useFileOpen(opts: UseFileOpenOptions = {}): UseFileOpen {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const triggerOpen = useCallback(() => {
    setError(null);
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<boolean> => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return false;
      const text = await readFileAsText(file);
      const result = deserialize(text);
      if (!result.ok) {
        setError(formatError(result.error));
        return false;
      }
      const { setTree, setFileName } = useBTStore.getState();
      setTree(result.tree);
      setFileName(file.name);
      opts.onSuccess?.();
      return true;
    },
    [opts],
  );

  return { fileInputRef, error, clearError, triggerOpen, handleFileSelected };
}
