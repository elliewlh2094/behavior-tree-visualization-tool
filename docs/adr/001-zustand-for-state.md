# ADR 001 — Zustand for global state

**Date:** 2026-04-22  
**Status:** Accepted

## Context

The app needs a single shared state store for the behavior tree, undo/redo history, validation results, and UI selection. Several options were considered.

## Decision

Use **Zustand** (`zustand@^5`) as the sole global state manager.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| React Context + useReducer | No built-in subscription granularity — every context consumer re-renders on any slice change. Fine for small apps; degrades when the canvas has dozens of nodes. |
| Redux Toolkit | Boilerplate-heavy for a single-page tool with no async data fetching. The slice/action/selector ceremony adds overhead without a proportionate benefit at this scale. |
| MobX | Observable mutation model conflicts with React Flow's immutable-node-array contract. Mixing the two requires explicit reaction/autorun wiring that is hard to reason about. |
| Jotai (atoms) | Per-atom granularity is a good fit for form state but awkward for the whole-tree operations (undo snapshots entire `BehaviorTree`). |

## Consequences

- Store lives in `src/store/bt-store.ts`. All mutations go through store actions; components read slices via `useStore(selector)`.
- Undo history is kept inside the store as a `RingBuffer<BehaviorTree>` (capacity 10). Snapshots are full-tree clones — cheap for trees of the size this tool targets (dozens of nodes).
- Testing store logic does not require React: `bt-store.ts` exports typed action functions that can be called directly in Vitest unit tests.
