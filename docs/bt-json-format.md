# Behavior Tree JSON Format — v1

> Status: **v1 — frozen for the v1 release of the tool.**
> Last updated: 2026-04-22
> Companion to: `SPEC.md` (authoritative for scope), `src/core/model/*` (TypeScript mirror).

This document defines the on-disk file format used by the Behavior Tree Visualization Tool. It is normative: the loader, serializer, and schema validator must conform to what is specified here. Any deviation is a bug in either this document or the code.

## 1. File conventions

| Aspect | Value |
|---|---|
| Extension | `.json` |
| Encoding | UTF-8. BOM is not accepted. |
| MIME type | `application/json` |
| Newlines | Writer emits `\n`. Reader accepts `\n` and `\r\n`. |
| Pretty-printing | Writer emits pretty-printed JSON with 2-space indentation. Reader accepts any JSON whitespace. |
| Key order in writer output | Top-level: `version, rootId, nodes, connections`. Per-node: `id, kind, name, position, properties`. Per-connection: `id, parentId, childId, order`. |

**Why fix a key order on write?** It makes `save → load → save` produce byte-identical output for unchanged trees (Success Criterion dependency for S8). `JSON.stringify` with a custom replacer enforces this; readers ignore key order (standard JSON semantics).

## 2. Top-level shape

```json
{
  "version": 1,
  "rootId": "<node-id>",
  "nodes": [ /* BTNode[] */ ],
  "connections": [ /* BTConnection[] */ ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer literal `1` | yes | Format version. Breaking changes bump this. v1 is the only value accepted in this release. |
| `rootId` | string | yes | The `id` of the single `Root` node. Must equal the `id` of a node in `nodes` whose `kind === "Root"`. |
| `nodes` | array of `BTNode` | yes | All nodes in the tree. Empty array is rejected — there must always be at least the Root. |
| `connections` | array of `BTConnection` | yes | All parent→child edges. May be empty. |

**Unknown fields at the top level are rejected** (schema strict mode). Additive changes in future versions must bump `version`.

## 3. `BTNode` shape

```json
{
  "id": "f2e0c8a0-1b2c-4d3e-8f9a-1234567890ab",
  "kind": "Sequence",
  "name": "Pick up object",
  "position": { "x": 320, "y": 160 },
  "properties": {}
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | non-empty string | yes | Unique within the document. Opaque — any stable string works. Tool writes UUIDv4. |
| `kind` | one of the 8 `NodeKind` literals | yes | See §3.1. |
| `name` | string (may be empty) | yes | Human-readable label. |
| `position` | `{x: number, y: number}` | yes | Canvas coordinates, in CSS pixels at 1:1 zoom. Floats allowed. Negative allowed. |
| `properties` | object (record) | yes | Reserved for kind-specific data in v2. **In v1, value must be `{}`.** Loader preserves on round-trip; non-empty values are accepted but ignored. |

**Unknown fields on a node are rejected.**

### 3.1 `NodeKind`

Exactly these 8 string literals. Case-sensitive.

| Kind | Semantics | Structural rules (see §5) |
|---|---|---|
| `Root` | The single entry point. Exactly one per tree. | Exactly 1 child. Cannot be a child of any node. |
| `Sequence` | Composite: ticks children in order; succeeds when all succeed, fails on first failure. | ≥1 child. |
| `Fallback` | Composite: ticks children in order; succeeds on first success, fails when all fail. Also known as "Selector." | ≥1 child. |
| `Parallel` | Composite: ticks all children; success/failure policy is kind-specific (deferred to v2). | ≥1 child. |
| `Decorator` | Unary modifier that transforms a single child's result. Decorator sub-kind (Inverter, Retry, etc.) deferred to v2. | Exactly 1 child. |
| `Action` | Leaf: performs work, returns success/failure/running. | No children. |
| `Condition` | Leaf: evaluates a predicate, returns success/failure. | No children. |
| `Group` | Visual/organizational wrapper that labels a region of the tree. Carries no runtime semantics — it is transparent to execution. | 0..n children (no rule). |

## 4. `BTConnection` shape

```json
{
  "id": "conn-01",
  "parentId": "<node-id>",
  "childId": "<node-id>",
  "order": 0
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | non-empty string | yes | Unique within the document. Used so connections are selectable/undoable independently of their endpoints. |
| `parentId` | string | yes | Must reference an `id` in `nodes`. |
| `childId` | string | yes | Must reference an `id` in `nodes`. Must not equal `parentId`. |
| `order` | integer ≥ 0 | yes | Sibling ordering among connections that share the same `parentId`. See §4.1. |

**Unknown fields on a connection are rejected.**

### 4.1 `order` semantics

- `order` is an arbitrary non-negative integer. Values need not be contiguous (`[0, 5, 10]` is valid).
- Siblings sharing a `parentId` are rendered and executed **left-to-right by ascending `order`**.
- Ties (equal `order` under the same parent) are permitted; rendering breaks them by `id` lexical ascending. This keeps rendering deterministic without forcing the loader to mutate the data.
- **Round-trip invariant:** the loader MUST NOT renumber `order` on load. Save → load → save on an unchanged tree produces byte-identical output.

## 5. Structural rules

These rules are evaluated **on demand** by the app's "Validate" command. They do not prevent a file from loading — a malformed tree must still be openable so the user can see and fix it. Rules fall into two severity levels: **error** (blocks a well-formed tree) and **warning** (acceptable in progress but flagged).

| # | Rule | Severity |
|---|---|---|
| R1 | Exactly one `Root` node exists, and its `id === rootId`. | error |
| R2 | `Root` has exactly 1 outgoing connection (exactly 1 child). | error |
| R3 | `Action` and `Condition` nodes have 0 outgoing connections (are leaves). | error |
| R4 | `Sequence`, `Fallback`, and `Parallel` nodes have ≥1 outgoing connection. | error |
| R5 | `Decorator` nodes have exactly 1 outgoing connection. | error |
| R6 | The directed graph formed by connections contains no cycles. | error |
| R7 | Every non-Root node has exactly 1 incoming connection, OR zero incoming connections. | error if >1 parent; warning if 0 parents (orphaned). |
| R8 | Orphaned non-Root nodes (0 parents) are preserved but produce a warning. | warning |

**Orphaned nodes are first-class in v1.** Deleting a non-Root node leaves its former children as orphans (SPEC Success Criterion 2). R8 reports them so the user knows. A cleanup operation (bulk-delete orphans) is out of scope for v1.

### 5.1 What the validator is NOT responsible for

- Semantic correctness of the tree's *behavior* (e.g., "this Fallback has no Action child that can ever succeed"). V1 is structural only.
- Kind-specific property validation (`properties` is ignored in v1).
- The `SubTree` kind (leaf reference to another tree) is reserved for post-v1; v1 uses `Group` for in-tree visual grouping instead.

## 6. Load-time (schema) vs. on-demand (validation) errors

| Class | Where detected | User experience |
|---|---|---|
| **Schema errors** — malformed JSON, wrong types, missing required fields, unknown fields, invalid `kind`, duplicate `id`, dangling reference (`parentId`/`childId`/`rootId` with no matching node) | Load time, by zod | File does not open. Toast/panel shows the zod path (e.g. `nodes[3].kind: "Unknown" is not a valid NodeKind`). |
| **Structural errors** (§5 rules) | On-demand, by validator | File opens. Validation panel lists issues. Each issue is clickable and selects the offending node. |

The split exists because a user debugging an invalid tree needs to *see* it to fix it — silently refusing to load because the Decorator has two children would be user-hostile.

## 7. Worked example

A minimal 5-node tree: `Root → Sequence → [Action "move", Condition "sees target", Action "grab"]`.

```json
{
  "version": 1,
  "rootId": "root-1",
  "nodes": [
    {
      "id": "root-1",
      "kind": "Root",
      "name": "Root",
      "position": { "x": 400, "y": 80 },
      "properties": {}
    },
    {
      "id": "seq-1",
      "kind": "Sequence",
      "name": "Pick up object",
      "position": { "x": 400, "y": 200 },
      "properties": {}
    },
    {
      "id": "act-move",
      "kind": "Action",
      "name": "Move to target",
      "position": { "x": 240, "y": 320 },
      "properties": {}
    },
    {
      "id": "cond-sees",
      "kind": "Condition",
      "name": "Sees target",
      "position": { "x": 400, "y": 320 },
      "properties": {}
    },
    {
      "id": "act-grab",
      "kind": "Action",
      "name": "Grab target",
      "position": { "x": 560, "y": 320 },
      "properties": {}
    }
  ],
  "connections": [
    { "id": "c1", "parentId": "root-1", "childId": "seq-1", "order": 0 },
    { "id": "c2", "parentId": "seq-1",  "childId": "act-move",  "order": 0 },
    { "id": "c3", "parentId": "seq-1",  "childId": "cond-sees", "order": 1 },
    { "id": "c4", "parentId": "seq-1",  "childId": "act-grab",  "order": 2 }
  ]
}
```

## 8. Versioning policy

- The current version is `1`. A loader encountering any other `version` value rejects the file with a clear "unsupported format version" error.
- **Additive changes** (new optional fields, new node kinds) in a v1-compatible way are not permitted — they require a version bump. Keeping v1 closed avoids silent compatibility surprises.
- **Breaking changes** (renamed fields, removed fields, changed semantics) bump `version` to `2` and the tool ships a migration path (v1 → v2 on load).

## 9. Appendix: TypeScript mirror

The canonical types live under `src/core/model/` and must stay in sync with this document. The sketches below are non-normative — treat this markdown as the source of truth and the `.ts` files as its implementation.

```ts
export const NODE_KINDS = [
  'Root', 'Sequence', 'Fallback', 'Parallel',
  'Decorator', 'Action', 'Condition', 'Group',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface BTNode {
  id: string;
  kind: NodeKind;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
}

export interface BTConnection {
  id: string;
  parentId: string;
  childId: string;
  order: number;
}

export interface BehaviorTree {
  version: 1;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}
```
