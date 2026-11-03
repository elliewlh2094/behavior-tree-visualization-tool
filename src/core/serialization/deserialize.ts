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
 * 把 JSON 字串解析成 `BTDocument`。接受 v1（透過 T3 的 migrateV1toV2
 * 自動遷移）與 v2 輸入。從 v1.4 起，成功時一律產生 v2 文件，
 * 呼叫端可以依賴 `document.version === 2`。
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
