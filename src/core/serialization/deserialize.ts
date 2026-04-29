import type { BTDocument } from '../model/node';
import { parseBTDocument } from '../schema/bt-schema';

export type DeserializeIssue = {
  path: (string | number)[];
  message: string;
};

export type DeserializeError =
  | { kind: 'parse'; message: string }
  | { kind: 'schema'; issues: DeserializeIssue[] }
  | { kind: 'unsupported-version'; version: unknown; message: string };

export type DeserializeResult =
  | { ok: true; document: BTDocument }
  | { ok: false; error: DeserializeError };

/**
 * Parse a JSON string into a `BTDocument`. Accepts both v1 (auto-migrated
 * via T3's migrateV1toV2) and v2 inputs. v1.4 onwards always produces a
 * v2 document on success — callers can rely on `document.version === 2`.
 */
export function deserialize(input: string): DeserializeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'parse',
        message: `Malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  const result = parseBTDocument(parsed);
  if (result.ok) {
    return { ok: true, document: result.document };
  }
  return { ok: false, error: result.error };
}
