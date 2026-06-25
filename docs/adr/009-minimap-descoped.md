# ADR 009 — Minimap (FR7) descoped from v1.11; implementation preserved in history

**Date:** 2026-06-25
**Status:** Accepted

## Context

v1.11 FR7 added React Flow's built-in `<MiniMap>` to the canvas for navigating large trees. It was implemented and verified (commit `bb009e0`): theme-aware `bgColor`/`maskColor`, `nodeColor` mirroring each kind's user-chosen color family, hidden during image export, pannable/zoomable, plus a controlled-mode fix (`initialWidth/initialHeight` on the derived nodes) so `getNodesBounds`/MiniMap saw node dimensions. All five manual smokes passed.

Testing against several real behavior trees then exposed a value problem the acceptance criteria did not capture. A minimap exists to give simultaneous **whole + local** awareness of a structure. But:

- **xyflow's built-in MiniMap renders only colored node rectangles — no labels, no connections.** For a behavior tree, where meaning lives in the node names and the parent→child control flow, color blocks alone convey almost no structural information.
- **The value is domain-sensitive.** A positional minimap pays off for large, sprawling node graphs (n8n, shader editors). Behavior trees are top-down hierarchies of modest size; the spatial-navigation need is low.
- **It overlaps with FR6 search (shipped in the same release).** "Find a specific node" — the most common navigation need for a BT — is already solved by Ctrl+F + center-on-match. The minimap's marginal value over search is small.

Net: in its built-in form the minimap is a vitamin, not a painkiller, and a component that *looks* informative while conveying little risks misleading users and adding canvas noise.

## Decision

**Remove the minimap from the v1.11 product; preserve the implementation in git history rather than as dead/commented code.**

1. `Canvas.tsx` is reverted to its pre-FR7 state — `<MiniMap>`, the theme `minimapBg`/`minimapMask` fields, the `minimapNodeColor` callback, and the `initialWidth/initialHeight` seeding (which existed *only* to feed the minimap) are all removed. `e2e/minimap.spec.ts` is deleted.
2. The working implementation lives in commit `bb009e0` ("v1.11 Phase B(T11): FR7 小地圖"). Resurrecting it is a `git revert`/cherry-pick away — no commented-out code is left in the tree, honoring the repo's surgical / no-dead-code conventions.
3. FR7 is marked **deferred** (not dropped) in `SPEC-v1.11.md`, `roadmap.md`, and `v1.11-todo.md`. v1.11 ships its other features (FR3/FR5/FR6/FR8/FR9) unaffected.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| **Keep the built-in minimap as-is** | Ships a low-value, potentially misleading component for this domain; overlaps with search. |
| **Build a custom MiniMap node component now** (labels + edges) | The right long-term form, but real work with its own legibility/perf questions at minimap scale. Not justified before any user demand — that's the FR7 v2 trigger, not a v1.11 task. |
| **Feature flag (`ENABLE_MINIMAP = false`)** | Keeps instantly-toggleable code in-tree, but it is dead code that rots and contradicts the no-dead-code convention. Git history already provides the "keep it for later" guarantee. |
| **Comment the code out in `Canvas.tsx`** | Same dead-code objection, worse: commented blocks drift out of sync with the surrounding file on every future edit. |

## Consequences

- **v1.11 scope shrinks by one feature.** The release narrative becomes web presence + search + templates + unsaved guard; navigation of large trees is served by search and fit-view, not a minimap.
- **Revisit trigger is explicit:** real user feedback that large trees are hard to navigate, *or* a better representation (custom node component showing labels/connections). Until then FR7 stays deferred.
- **No runtime/bundle cost** from the removed component; `@xyflow/react`'s MiniMap is tree-shaken out of the import.
- **Decision is traceable** here and in the AD index (AD9) so the descope — and the preserved commit — are not mistaken for an oversight.
