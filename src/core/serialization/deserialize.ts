import type { BehaviorTree } from '../model/node';
import { btTreeSchema } from '../schema/bt-schema';

export type DeserializeIssue = {
  path: (string | number)[];
  message: string;
};

export type DeserializeError =
  | { kind: 'parse'; message: string }
  | { kind: 'schema'; issues: DeserializeIssue[] };

export type DeserializeResult =
  | { ok: true; tree: BehaviorTree }
  | { ok: false; error: DeserializeError };

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

  const result = btTreeSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: {
        kind: 'schema',
        issues: result.error.issues.map((i) => ({
          path: [...i.path],
          message: i.message,
        })),
      },
    };
  }

  return { ok: true, tree: result.data };
}
