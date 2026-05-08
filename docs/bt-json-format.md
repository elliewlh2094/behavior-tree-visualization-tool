# Behavior Tree JSON Format

> Status: **v2 current** (shipped in tool v1.4). v1 files are accepted and auto-migrated on open; all saves emit v2.
> Last updated: 2026-05-08
> Companion to: `SPEC.md` (authoritative for scope), `src/core/model/*` (TypeScript mirror), `docs/adr/005-document-model-and-file-format-v2.md` (rationale for the v1 → v2 promotion).

This document defines the on-disk file format used by the Behavior Tree Visualization Tool. It is normative: the loader, serializer, and schema validator must conform to what is specified here. Any deviation is a bug in either this document or the code.

The format gained a multi-tree document wrapper (`BTDocument`) in v2 to support the `SubTree` node kind (a node that references another tree by name). v1 single-tree files remain readable forever — see §8 for the migration semantics.

## 1. File conventions

| Aspect | Value |
|---|---|
| Extension | `.json` |
| Encoding | UTF-8. BOM is not accepted. |
| MIME type | `application/json` |
| Newlines | Writer emits `\n`. Reader accepts `\n` and `\r\n`. |
| Pretty-printing | Writer emits pretty-printed JSON with 2-space indentation. Reader accepts any JSON whitespace. |
| Key order in writer output | Top-level: `version, mainTreeId, trees`. Per-tree: `id, name, rootId, nodes, connections`. Per-node: `id, kind, name, position, properties, treeRef` (`treeRef` omitted when absent). Per-connection: `id, parentId, childId, order`. |

**Why fix a key order on write?** It makes `save → load → save` produce byte-identical output for unchanged trees (Success Criterion dependency for S8). `JSON.stringify` with a custom replacer enforces this; readers ignore key order (standard JSON semantics).

## 2. Top-level shape

A v2 document is a `BTDocument` — a wrapper around one or more tree definitions.

```json
{
  "version": 2,
  "mainTreeId": "<tree-id>",
  "trees": [ /* BTTreeDef[] */ ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | integer literal `2` | yes | Format version. v2 is the only value the writer emits; the loader also accepts `1` and migrates (see §8). |
| `mainTreeId` | string | yes | The `id` of the entry-point tree definition. Must equal the `id` of a member of `trees`. |
| `trees` | non-empty array of `BTTreeDef` | yes | All tree definitions in the document. Must contain at least one tree (the main tree). Tree `name` values must be **unique** within the document — `SubTree.treeRef` looks up references by name (see §3.1). |

**Unknown fields at the top level are rejected** (schema strict mode). Additive changes in future versions must bump `version`.

### 2.1 `BTTreeDef` shape

```json
{
  "id": "tree-uuid",
  "name": "Main",
  "rootId": "<node-id>",
  "nodes": [ /* BTNode[] */ ],
  "connections": [ /* BTConnection[] */ ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | non-empty string | yes | Unique within the document. Opaque — any stable string works. Tool writes UUIDv4. Used by `mainTreeId` and by the editor's per-tab state; it is **not** the reference target for SubTree nodes — that's `name` (see §3.1). |
| `name` | non-empty string | yes | Human-readable label, shown on the tab. SubTree nodes reference trees by this value. Must be unique among `trees`. |
| `rootId` | string | yes | The `id` of this tree's `Root` node. Same per-tree rules as v1 — see §3 and §5. |
| `nodes` | array of `BTNode` | yes | This tree's nodes. Empty array is rejected — there must always be at least the Root. |
| `connections` | array of `BTConnection` | yes | This tree's parent→child edges. May be empty. |

**Unknown fields on a tree are rejected.**

### 2.2 v1 (legacy) top-level shape

v1 files (`version: 1`) carry a single tree's data inline at the top level — no wrapper:

```json
{
  "version": 1,
  "rootId": "<node-id>",
  "nodes": [ /* BTNode[] */ ],
  "connections": [ /* BTConnection[] */ ]
}
```

The loader detects v1 by the literal `version` value and routes through `migrateV1toV2` — see §8.

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
| `id` | non-empty string | yes | Unique within the document (across all trees). Opaque — any stable string works. Tool writes UUIDv4. |
| `kind` | one of the 9 `NodeKind` literals | yes | See §3.1. |
| `name` | string (may be empty) | yes | Human-readable label. For `SubTree` nodes the editor keeps `name` and `treeRef` in lockstep (renaming the referenced tree updates this field). |
| `position` | `{x: number, y: number}` | yes | Canvas coordinates, in CSS pixels at 1:1 zoom. Floats allowed. Negative allowed. |
| `properties` | object (record) | yes | Reserved for future kind-specific data. Loader preserves on round-trip; non-empty values are accepted but currently ignored. |
| `treeRef` | non-empty string | only on `SubTree` | Name of another tree in the document this SubTree expands to. Must match some `BTTreeDef.name`. Forbidden on every other kind. |

**Unknown fields on a node are rejected.**

### 3.1 `NodeKind`

Exactly these 9 string literals. Case-sensitive.

| Kind | Semantics | Structural rules (see §5) |
|---|---|---|
| `Root` | The single entry point. Exactly one per tree. | Exactly 1 child. Cannot be a child of any node. |
| `Sequence` | Composite: ticks children in order; succeeds when all succeed, fails on first failure. | ≥1 child. |
| `Fallback` | Composite: ticks children in order; succeeds on first success, fails when all fail. Also known as "Selector." | ≥1 child. |
| `Parallel` | Composite: ticks all children; success/failure policy is kind-specific (deferred to a later version). | ≥1 child. |
| `Decorator` | Unary modifier that transforms a single child's result. Decorator sub-kind (Inverter, Retry, etc.) deferred to a later version. | Exactly 1 child. |
| `Action` | Leaf: performs work, returns success/failure/running. | No children. |
| `Condition` | Leaf: evaluates a predicate, returns success/failure. | No children. |
| `Group` | Visual/organizational wrapper that labels a region of the tree. Carries no runtime semantics — it is transparent to execution. | 0..n children (no rule). |
| `SubTree` | Leaf reference to another tree definition in the same document. The reference is by `treeRef` (tree name), not by id, so authors can reason about subtrees by readable name. | No children (leaf). |

**Why reference by name, not id?** Tree names are what authors see on tabs and in the property-panel dropdown; ids are opaque UUIDs. Reference-by-name also survives id regeneration (e.g., during v1 → v2 migration) without rewriting `treeRef` values. The cost is that `name` must be unique within the document — enforced by the schema.

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

### 4.2 Authoring-time reorder (v1)

The editor derives `order` from **horizontal layout**: at the end of each drag gesture, siblings under the same parent are renumbered to contiguous `0..n-1` by ascending `position.x`. Ties on `x` are broken by preserving the dragged node's current `order` (stable sort).

This means the author reorders siblings by dragging them left or right within the canvas — no dedicated reorder control. Rationale:

- Matches the rendering rule in §4.1 (left-to-right by ascending `order`), so visual and logical order cannot drift.
- Every drag produces a single undoable step that covers both `position` and `order` changes (the history snapshot fires at drag start, per the ring-buffer history).
- Orphaned nodes (no incoming connection) have no siblings in the graph sense and are never renumbered.

A future edit mechanism (explicit "Move left / Move right" buttons, or a batch "Apply layout" toolbar command) could be layered on top without changing the on-disk format, because the renumbering is performed by the pure `reorderChildren` operation and the UI is only one of its possible callers.

## 5. Structural rules

These rules are evaluated **on demand** by the app's "Validate" command. They do not prevent a file from loading — a malformed tree must still be openable so the user can see and fix it. Rules fall into two severity levels: **error** (blocks a well-formed tree) and **warning** (acceptable in progress but flagged).

| # | Rule | Scope | Severity |
|---|---|---|---|
| R1 | Exactly one `Root` node exists, and its `id === rootId`. | per-tree | error |
| R2 | `Root` has exactly 1 outgoing connection (exactly 1 child). | per-tree | error |
| R3 | `Action`, `Condition`, and `SubTree` nodes have 0 outgoing connections (are leaves). | per-tree | error |
| R4 | `Sequence`, `Fallback`, and `Parallel` nodes have ≥1 outgoing connection. | per-tree | error |
| R5 | `Decorator` nodes have exactly 1 outgoing connection. | per-tree | error |
| R6 | The directed graph formed by connections contains no cycles. | per-tree | error |
| R7 | Every non-Root node has exactly 1 incoming connection, OR zero incoming connections. | per-tree | error if >1 parent; warning if 0 parents (orphaned). |
| R8 | Orphaned non-Root nodes (0 parents) are preserved but produce a warning. | per-tree | warning |
| R9 | Every `SubTree` node's `treeRef` matches the `name` of some tree in the document. | document | error |
| R10 | The cross-tree subtree-reference graph contains no cycles (no `T → T`, no `A → B → A`, no longer cycles). | document | error |

Per-tree rules (R1–R8) are evaluated against each `BTTreeDef` in `document.trees`. Document rules (R9, R10) are evaluated once, against the whole document.

**Orphaned nodes are first-class in v2** (carried over from v1). Deleting a non-Root node leaves its former children as orphans (SPEC Success Criterion 2). R8 reports them so the user knows. A cleanup operation (bulk-delete orphans) remains out of scope.

**Each issue carries a `treeId`** identifying the originating tree, so the editor's validation panel can route the user to the right tab when an issue is clicked. For document-scope rules: R9's issue lives in the tree containing the offending SubTree node; R10's issue lives in the cycle's first tree (the DFS anchor — the full cycle path is in the message).

### 5.1 What the validator is NOT responsible for

- Semantic correctness of the tree's *behavior* (e.g., "this Fallback has no Action child that can ever succeed"). The validator is structural only.
- Kind-specific property validation (`properties` is currently ignored).

## 6. Load-time (schema) vs. on-demand (validation) errors

| Class | Where detected | User experience |
|---|---|---|
| **Schema errors** — malformed JSON, wrong types, missing required fields, unknown fields, invalid `kind`, duplicate `id`, duplicate tree `name`, dangling reference (`parentId`/`childId`/`rootId` with no matching node, or `mainTreeId` with no matching tree) | Load time, by zod | File does not open. Toast/panel shows the zod path (e.g. `trees[1].nodes[3].kind: "Unknown" is not a valid NodeKind`). |
| **Structural errors** (§5 rules) | On-demand, by validator | File opens. Validation panel lists issues. Each issue is clickable and selects the offending node. |

The split exists because a user debugging an invalid tree needs to *see* it to fix it — silently refusing to load because the Decorator has two children would be user-hostile.

## 7. Worked example

A two-tree document. The main tree `"Patrol"` runs a SubTree reference to `"Pickup"`, which is the prior single-tree example wrapped as a tree definition.

```json
{
  "version": 2,
  "mainTreeId": "tree-patrol",
  "trees": [
    {
      "id": "tree-patrol",
      "name": "Patrol",
      "rootId": "p-root",
      "nodes": [
        {
          "id": "p-root",
          "kind": "Root",
          "name": "Root",
          "position": { "x": 400, "y": 80 },
          "properties": {}
        },
        {
          "id": "p-seq",
          "kind": "Sequence",
          "name": "Patrol loop",
          "position": { "x": 400, "y": 200 },
          "properties": {}
        },
        {
          "id": "p-walk",
          "kind": "Action",
          "name": "Walk waypoint",
          "position": { "x": 280, "y": 320 },
          "properties": {}
        },
        {
          "id": "p-pickup",
          "kind": "SubTree",
          "name": "Pickup",
          "position": { "x": 520, "y": 320 },
          "properties": {},
          "treeRef": "Pickup"
        }
      ],
      "connections": [
        { "id": "pc1", "parentId": "p-root", "childId": "p-seq",    "order": 0 },
        { "id": "pc2", "parentId": "p-seq",  "childId": "p-walk",   "order": 0 },
        { "id": "pc3", "parentId": "p-seq",  "childId": "p-pickup", "order": 1 }
      ]
    },
    {
      "id": "tree-pickup",
      "name": "Pickup",
      "rootId": "u-root",
      "nodes": [
        {
          "id": "u-root",
          "kind": "Root",
          "name": "Root",
          "position": { "x": 400, "y": 80 },
          "properties": {}
        },
        {
          "id": "u-seq",
          "kind": "Sequence",
          "name": "Pick up object",
          "position": { "x": 400, "y": 200 },
          "properties": {}
        },
        {
          "id": "u-move",
          "kind": "Action",
          "name": "Move to target",
          "position": { "x": 240, "y": 320 },
          "properties": {}
        },
        {
          "id": "u-sees",
          "kind": "Condition",
          "name": "Sees target",
          "position": { "x": 400, "y": 320 },
          "properties": {}
        },
        {
          "id": "u-grab",
          "kind": "Action",
          "name": "Grab target",
          "position": { "x": 560, "y": 320 },
          "properties": {}
        }
      ],
      "connections": [
        { "id": "uc1", "parentId": "u-root", "childId": "u-seq",  "order": 0 },
        { "id": "uc2", "parentId": "u-seq",  "childId": "u-move", "order": 0 },
        { "id": "uc3", "parentId": "u-seq",  "childId": "u-sees", "order": 1 },
        { "id": "uc4", "parentId": "u-seq",  "childId": "u-grab", "order": 2 }
      ]
    }
  ]
}
```

## 8. Versioning policy

- The current version is `2`. The writer always emits `2`; the loader accepts `1` (auto-migrated) and `2` (validated as-is). Any other `version` value is rejected with a clear "unsupported format version" error.
- **Additive changes** (new optional fields, new node kinds) in a backward-compatible way are not permitted within a fixed version. They require a version bump. Keeping each version closed avoids silent compatibility surprises.
- **Breaking changes** (renamed fields, removed fields, changed semantics) bump `version` and the tool ships a migration path. v1 → v2 is the first such migration.

### 8.1 v1 → v2 migration

Triggered automatically when the loader sees `version: 1`. The single tree at the top level is wrapped as a `BTTreeDef` and placed inside a one-element `BTDocument`.

| v1 input | v2 output |
|---|---|
| `version: 1` | `version: 2` |
| top-level `rootId, nodes, connections` | one tree with the same `rootId, nodes, connections` |
| (no name concept) | tree `name` defaults to `"Main"` |
| (no document id) | new `mainTreeId` (UUIDv4) matches the wrapping tree's `id` |

Node `id`s are preserved exactly. The wrapping tree gets a fresh UUIDv4 `id`. After migration, save produces a v2 file — the original v1 file on disk is not modified. Re-saving an unchanged v1 file therefore produces a *new* file shape (v2), not a byte-identical v1 copy.

The byte-identical save-load-save invariant (§4.1) holds *within v2*: any v2 file that loads cleanly will round-trip byte-identically. Only the v1 → v2 transition crosses a format boundary.

## 9. Appendix: TypeScript mirror

The canonical types live under `src/core/model/` and must stay in sync with this document. The sketches below are non-normative — treat this markdown as the source of truth and the `.ts` files as its implementation.

```ts
export const NODE_KINDS = [
  'Root', 'Sequence', 'Fallback', 'Parallel',
  'Decorator', 'Action', 'Condition', 'Group', 'SubTree',
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface BTNode {
  id: string;
  kind: NodeKind;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, unknown>;
  // Required (and non-empty) when `kind === 'SubTree'`; forbidden otherwise.
  treeRef?: string;
}

export interface BTConnection {
  id: string;
  parentId: string;
  childId: string;
  order: number;
}

export interface BTTreeDef {
  id: string;
  name: string;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}

export interface BTDocument {
  version: 2;
  mainTreeId: string;
  trees: BTTreeDef[];
}

// v1 (legacy) — retained only for the migration path on load.
export interface BehaviorTree {
  version: 1;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}
```
