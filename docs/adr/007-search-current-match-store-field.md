# ADR 007 — Transient `searchCurrentId` store field for the current-match highlight (FR6)

**Date:** 2026-06-23
**Status:** Accepted

## Context

`docs/SPEC-v1.11.md` FR6 (node search) enumerates the search state to live in the store as exactly two transient fields: `searchOpen` and `searchMatchIds`, and says "Canvas injects `isSearchMatch` into node data". The matching `docs/tasks/v1.11-todo.md` T9 additionally requires **two** distinct highlights — a "search-match" ring on every match **and** a stronger "current-match" highlight on the one the user is stepped onto — plus centering the current match.

These two documents are in tension. `searchMatchIds` is a `ReadonlySet<string>` (chosen so `BTNode` can do an O(1) `has(id)` membership test for the match ring). A `Set` is unordered: it can answer *"is this node a match?"* but not *"which one of N matches is current?"*. The current-match highlight needs the latter.

The data-flow constraint makes this sharper. Node highlights are painted by `BTNode`, whose props come from `node.data`, which is assembled by `Canvas`, which reads only the **store**. But the *current index* is owned by `SearchBox` (the input component advances it on Enter / ↑ / ↓). `SearchBox` and `Canvas` are siblings; the only channel between them is the store — the same path selection (`selection.nodeIds`) and image-export mode (`exportInProgress`) already travel.

So: with only the two spec'd fields, the current match could be conveyed **only** by the camera centering on it — no distinct ring. When several matches cluster on screen, centering alone is ambiguous (you can't tell which highlighted node is the "2/5").

## Decision

Add a third transient store field, **`searchCurrentId: string | null`**, alongside `searchOpen` and `searchMatchIds`.

- `searchMatchIds` keeps its single responsibility: *membership* ("is this node a match?") for the match ring, O(1) in `BTNode`.
- `searchCurrentId` answers the orthogonal question: *cursor* ("is this node the current one?") for the stronger ring + the node that gets centered.
- `SearchBox` owns the ordered match list and the current index locally; it writes both `searchMatchIds` and `searchCurrentId` to the store. `Canvas` injects `isSearchMatch` **and** `isCurrentMatch` into `node.data` from those two fields.

The field is fully transient, exactly like the other two: a plain setter that bypasses `withSnapshot`, never part of `DocSnapshot`, never pushed to history, and cleared (along with `searchMatchIds`) when search closes (`setSearchOpen(false)`).

This is a documented deviation from the SPEC FR6 two-field list — a **count** difference (3 fields instead of 2), not a behavioral or architectural one. It is recorded in `v1.11-todo.md` T9's Deviation block and here.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| **Strict spec: only center, no distinct current ring** | Satisfies the SPEC FR6 acceptance literally but fails the todo T9 "current-match highlight" requirement, and gives weaker UX — clustered matches become indistinguishable when only the camera moves. |
| **Replace the `Set` with an ordered match array + index in the store** | Overloads `searchMatchIds` with two responsibilities (membership *and* order), and costs `BTNode` its O(1) membership check (it would scan/`indexOf` the array per node). Two orthogonal questions are cleaner as two fields. |
| **Prop-drill / React context from `SearchBox` to `BTNode`** | `SearchBox` doesn't own `Canvas`'s node assembly. Threading the current index up to `Canvas` (or adding a context provider) is more plumbing than one transient field, and breaks the established store → Canvas → `node.data` flow that selection and export mode already use. |
| **Derive "current" in `Canvas`/`BTNode`** | Not derivable — "current" is navigation state (which match the user stepped to), not a function of the document or the query. It must be stored. |

## Consequences

- **Spec drift.** SPEC-v1.11 FR6's parenthetical file list (`transient searchOpen, searchMatchIds`) is now incomplete. It should be updated to mention `searchCurrentId` so the spec and code stop drifting (mirrors how the FR3 revision updated the spec post-Checkpoint-A).
- **No history/PWA impact.** The field is transient and bypasses `withSnapshot`, so the SPEC's real hard constraint — "search state is transient, not in undo/redo history" — is fully preserved. The deviation does not touch `DocSnapshot`, serialization, or the service worker.
- **Highlight composition.** `BTNode` composes the kind-colored selection ring (inner) and the brand/logo-green search ring (outer band; current match adds a soft glow) into a single `boxShadow`, and suppresses both during image export. A node that is simultaneously selected and the current match shows both rings without collision.
- **Effect-dependency footgun (noted for maintainers).** `SearchBox`'s reset-to-first effect is keyed on `[matches]` alone (with an `eslint-disable react-hooks/exhaustive-deps`, the same idiom Toolbar uses). `goToIndex` changes identity every render because it closes over xyflow's `getZoom`; including it would re-run the effect every render and reset the index out from under next/prev. Navigation calls `goToIndex` imperatively, never through that effect.
- **Cheap to revert.** If a future change moves search ownership (e.g. a command palette that owns navigation), `searchCurrentId` is a single transient field to retire — no migration, no persisted data.
