# ADR 004 — Child ordering derived from horizontal canvas position

**Date:** 2026-04-22  
**Status:** Accepted

## Context

Behavior tree semantics depend on child order: a Sequence ticks children left-to-right, stopping on the first failure. The tool must therefore preserve child order through save/load and give the author a clear, low-friction way to reorder siblings.

## Decision

Child order is **derived from horizontal canvas position**: after every drag gesture, siblings under the same parent are renumbered `0, 1, 2 …` by ascending `position.x`. The `order` field is stored in `BTConnection` (see `docs/bt-json-format.md` §4) and is the authoritative ordering for both rendering and export.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| Explicit "Move left / Move right" buttons | Requires dedicated UI surface (toolbar or right-click menu). Adds a second ordering mechanism that can disagree with visual layout. The positional approach is self-consistent: what you see is what executes. |
| Drag-to-reorder list in the property panel | Disconnects reordering from the canvas. The author would need to cross-reference the panel and the canvas to understand the tree. |
| Fixed insertion order (order of connection creation) | Non-obvious and hard to change. The only way to reorder would be to delete and re-draw connections. |
| Dedicated edge labels ("1st", "2nd") | Purely informational; does not give an edit affordance. |

## Consequences

- The author reorders siblings by dragging them left or right on the canvas — no additional UI control.
- This matches the rendering convention (left-to-right = first-to-last), so visual order and logical order cannot drift.
- `reorderChildren` in `src/core/model/operations.ts` is a pure function that takes an explicit `orderedChildIds` array and assigns contiguous `0..n-1` indices. The caller (store drag handler) derives the order from `position.x` before calling it.
- Ties on `x` are broken by stable sort (the dragged node's original `order` is preserved). Ties in saved files are broken by `id` lexical order on load (see `docs/bt-json-format.md` §4.1).
- The mechanism is intentionally separated from the file format: `order` is an opaque integer in the JSON. A future "Apply automatic layout" toolbar command could call `reorderChildren` with a layout-derived ordering without changing the format.
