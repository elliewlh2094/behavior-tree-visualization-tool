# ADR 005 — Multi-tree document model and file format v2

**Date:** 2026-04-29
**Status:** Accepted

## Context

v1.0–v1.3 represent a behavior tree as a single `BehaviorTree` with `version: 1`. v1.4 introduces SubTree references — a node kind that points to another tree definition by name — which cannot be expressed in a single-tree model. Two structural changes follow:

1. The persisted unit must hold N tree definitions plus a designated "main" entry point.
2. SubTree validation (R9 no dangling refs, R10 no cycles) operates over the cross-tree reference graph, not within a single tree.

This is the first release that touches the data model and the persisted file format, not just the UI. Prior architectural decisions (AD1–AD3) were UI- or layout-scoped; this one rewrites the contract that every save/load goes through.

## Decision

Promote the persisted unit from `BehaviorTree` to a new `BTDocument`:

```ts
interface BTDocument {
  version: 2;
  mainTreeId: string;
  trees: BTTreeDef[];
}
interface BTTreeDef {
  id: string;
  name: string;
  rootId: string;
  nodes: BTNode[];
  connections: BTConnection[];
}
```

The file format version bumps to 2. v1 files auto-migrate on open (single tree wrapped in a one-element document; default name `"Main"`). All saves emit v2.

`SubTree` is added as the 9th `NodeKind`. `BTNode` gains an optional `treeRef?: string` field, only meaningful when `kind === 'SubTree'`. The reference is by **tree name**, not tree id — this matches Groot2/BehaviorTree.CPP convention where authors reason about subtrees by readable name, and it survives id regeneration during migration.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Keep `BehaviorTree`, add a top-level `subtrees: Record<string, BehaviorTree>` field for v2 | Two-tier shape (one privileged tree + a dict of subtrees) makes "promote subtree to main" awkward and creates two code paths for SubTree resolution. A flat `trees: BTTreeDef[]` plus `mainTreeId` keeps one code path. |
| Inline subtrees by reference (no separate tree definitions) | Loses the *edit-once-applies-everywhere* property that motivates SubTrees in the first place. The whole point is shared definitions. |
| One file per tree (project model) | More radical change; implies a project/folder concept; loses single-file portability that the tool currently has. Reconsider in v2.0 with reusable templates. |
| Discriminated union on `BTNode` (`BasicNode \| SubTreeNode` with required `treeRef` on the variant) | More type-safe but ripples through 10 files / 45 type sites in `BehaviorTree`-handling code. Optional `treeRef?: string` is shipped per the v1.4 plan; tightening to a discriminated union can come as a later cleanup once the dust settles. |
| Reference subtrees by `treeId` instead of `name` | More refactor-stable across renames, but breaks the conceptual model — authors think in names, files are read by humans, and `treeId` is opaque UUID noise. Rename propagation (T11) handles the cost. |

## Consequences

- **Backward compatibility on read; not on write.** v1 files load via auto-migration in `deserialize`. Saves only emit v2 — users cannot round-trip-save back to v1. This is intentional: maintaining a v1-write path would double the serialization surface for marginal benefit. Documented in `docs/bt-json-format.md` (to be updated in T4).
- **Existing in-memory operations target a single `BTTreeDef`.** `addNode`, `connect`, `moveNode`, etc. continue to operate on the active tree. The store gains an `activeTreeId` (T6) to select which tree the canvas reads from.
- **Validation splits.** Rules R1–R8 remain per-tree; new R9 (`treeRef` references existing tree) and R10 (no circular subtree refs) operate on the whole document. `validate()` signature updates to accept `BTDocument` (T5).
- **`mainTreeId` is the entry point, not necessarily `trees[0]`.** Decouples array ordering from semantics — reordering tabs in T11 will not change which tree is "main". The main tree gains a subtle UI marker (T9).
- **Staged migration of `BehaviorTree`.** T1 keeps `BehaviorTree` as-is and only adds the new document types. T6 evolves the store to hold a `BTDocument` and starts retiring `BehaviorTree` from internal call sites. The type may live on as a deprecated alias for one more release before full removal — to be decided when T6 lands.
- **Round-trip determinism preserved.** Within each `BTTreeDef`, the canonical-key-order rule from v1 (`docs/bt-json-format.md` §4) carries over unchanged. The new document wrapper itself uses a fixed key order: `version`, `mainTreeId`, `trees`.
