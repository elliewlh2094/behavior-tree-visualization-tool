# ADR 002 — React Flow for the graph canvas

**Date:** 2026-04-22  
**Status:** Accepted

## Context

The core interaction surface of the tool is a zoomable, pannable canvas where nodes can be dragged, connected, and selected. This is a non-trivial rendering problem with well-known solutions.

## Decision

Use **`@xyflow/react`** (React Flow v12) as the graph canvas.

## Alternatives considered

| Option | Reason rejected |
|---|---|
| D3.js | Gives full control but requires implementing pan/zoom, drag, hit-testing, selection marquee, and edge routing from scratch. That work is orthogonal to the tool's value proposition. |
| Cytoscape.js | Mature graph library, but not React-native — integrating it requires imperative DOM refs and fights React's reconciler for ownership of node elements. |
| Custom `<canvas>` | Maximum performance ceiling, but custom hit-testing, text rendering, and accessibility are major implementation costs. Warranted only if React Flow's performance proves insufficient. |
| Vis.js | Similar impedance mismatch to Cytoscape; also has a heavier bundle. |

## Consequences

- Nodes are standard React components (`src/components/nodes/`), making it trivial to add rich content (icons, badges, port indicators) without leaving the React mental model.
- React Flow owns the viewport transform and edge routing; the store owns the graph data. Data flows one-way: store → React Flow props on every render.
- The built-in `<Controls />` overlay (zoom in/out, fit view, lock) ships for free — no custom implementation needed (see SPEC Q9).
- React Flow's `onNodeDragStop` fires after each drag gesture, which is the integration point for child-reordering (see ADR 004) and undo snapshot creation.
- Bundle cost: `@xyflow/react` adds ~90 kB gzipped. Acceptable for a tool app; revisit if a lightweight embed is ever needed.
