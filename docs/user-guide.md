# User Guide

A task-oriented reference for the Behavior Tree Visualization Tool. Assumes you know what a behavior tree is and have the app open.

> Living document. Updated as features ship. Current scope: S9 (pre-PWA).

## Keyboard reference

| Shortcut              | Action                                          |
| --------------------- | ----------------------------------------------- |
| Click                 | Select one node or edge                         |
| Shift + Click         | Add to or remove from selection                 |
| Shift + Drag          | Box-select nodes (edges must be clicked)        |
| Ctrl / Cmd + A        | Select every node and edge                      |
| Delete / Backspace    | Remove every selected node and edge (one step)  |
| Ctrl / Cmd + Z        | Undo                                            |
| Ctrl / Cmd + Shift + Z| Redo                                            |
| Ctrl / Cmd + S        | Save tree to a JSON file                        |
| Ctrl / Cmd + O        | Open a tree from a JSON file                    |

All shortcuts stay out of the way when your focus is in a text input — Ctrl/Cmd+A in the name field selects the field's text, not the canvas.

## Common workflows

### Build a tree

1. Drag a node kind from the left-hand palette onto the canvas. Positions snap to a 25 px grid.
2. Connect nodes by dragging from a parent's bottom handle to a child's top handle. Action and Condition nodes are leaves — they have no bottom handle by design.
3. Click a node to edit its **name** and **kind** in the right-hand property panel. The Root node's kind is locked; its name is editable.

### Reorder siblings

Drag a child node horizontally under its parent. When you release, the tool sorts the parent's children left-to-right and rewrites their `order` values. This is the only way to change child order; there's no "move up / move down" button.

### Select multiple items

- Shift-click a second node to add it to the selection.
- Shift-drag on empty canvas to box-select several nodes at once. Box-select covers nodes only; select edges by clicking them.
- Ctrl/Cmd+A selects everything, including edges.

Selecting more than one thing replaces the property panel with a summary like `2 nodes, 1 edge selected`. Edge properties aren't editable in v1.

### Delete

Select one or more items and press Delete or Backspace. One press is one undo step — so deleting three nodes and an edge is undone with a single Ctrl/Cmd+Z.

- **Root cannot be deleted.** If Root is part of a multi-selection and you press Delete, the other items are removed and Root stays. This is intentional.
- When you delete a parent, its children become orphans (no parent). They're still on the canvas, just disconnected. The Validate panel will flag them as R8 warnings.

### Undo and redo

History holds **five steps**. Past that, the oldest step falls off the back. Each text change in the property panel counts as its own step — so typing "Attack" eats five history slots. If you need to preserve a milestone, use Save.

Dragging a node is one undo step regardless of how far you drag.

### Save and open

- **Save** writes the current tree to `behavior-tree.json` in your browser's download location. The format is documented in [`bt-json-format.md`](./bt-json-format.md).
- **Open** replaces the current tree. Both undo and redo history are cleared — there's no way to undo an Open.
- If the file is malformed or fails schema validation, the toolbar shows a red error and the current tree is kept.

### Validate

Click **Validate** in the toolbar. The bottom panel lists structural issues, errors first. Click a row to select the offending node on the canvas — the property panel jumps to it so you can fix it in place.

Validate is a point-in-time check; it does not run continuously. After you edit, run it again.

## Understanding validation rules

Each rule is documented in full in [`bt-json-format.md` §5](./bt-json-format.md). Plain-language summaries:

| ID  | Severity | Meaning                                           | Typical fix                                           |
| --- | -------- | ------------------------------------------------- | ----------------------------------------------------- |
| R1  | error    | Exactly one Root node; its id is `rootId`.        | Should never fire from the UI — indicates a bad file. |
| R2  | error    | Root has exactly one child.                       | Connect Root to a single top-level composite.         |
| R3  | error    | Action and Condition have no children.            | Remove outgoing connections; these are leaves.        |
| R4  | error    | Sequence / Fallback / Parallel have ≥ 1 child.    | Connect at least one child, or change the kind.       |
| R5  | error    | Decorator has exactly 1 child.                    | Add or remove a child so the count is 1.              |
| R6  | error    | No cycles in the tree.                            | Break the loop by deleting a back-edge.               |
| R7  | error    | A non-Root node has at most 1 parent.             | Delete the extra incoming connection.                 |
| R8  | warning  | A non-Root node has no parent (orphan).           | Connect it to a parent, or delete it.                 |

## Known limitations (v1)

- Edge properties aren't editable.
- Box-select covers nodes only, not edges.
- Undo history is 5 steps and counts each keystroke as one step.
- The app is browser-only for now; offline install (PWA) ships in S10.
- The `Group` kind is present in the palette but reserved for post-v1 composition work — treat it as a labeled container for now.
