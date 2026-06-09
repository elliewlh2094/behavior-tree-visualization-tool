# User Guide

This document is the user guide for BT Visualizer. It assumes you already know what a behavior tree is and have the app open.

> This document is updated as features ship. Last updated: 2026.06.05.

## Keyboard reference

| Shortcut              | Action                                          |
| --------------------- | ----------------------------------------------- |
| Shift + Click         | Add to or remove from selection                 |
| Shift + Drag          | Box-select nodes (node edges must be clicked)   |
| Ctrl / Cmd + A        | Select every node and edge                      |
| Delete / Backspace    | Remove every selected node and edge (one step)  |
| Ctrl / Cmd + D        | Duplicate selected objects in place             |
| Ctrl / Cmd + Z        | Undo the previous action                        |
| Ctrl / Cmd + Shift + Z| Redo the previous undo                          |
| Ctrl / Cmd + S        | Save the current tree to a JSON file            |
| Ctrl / Cmd + O        | Open a tree from a JSON file                    |

## Common workflows

### Build a tree

1. Drag a node kind from the left-hand palette onto the canvas.
2. Connect nodes by dragging from a parent's bottom handle to a child's top handle. Action and Condition nodes are leaves — they have no bottom handle by design.
3. Click a node to edit its **name** and **node type (kind)** in the right-hand property panel. The Root node's kind is locked, but its name is editable.

A long node name wraps onto a second line on the canvas instead of being cut off; only names longer than two lines are truncated.

### Select multiple items

- `Shift + click` a second node to add it to the selection.
- `Shift + drag` on empty canvas to box-select several nodes at once. Box-select covers nodes only; select edges by clicking them.
- `Ctrl/Cmd+A` selects everything, including edges.

Selecting more than one thing replaces the property panel with a summary like `2 nodes, 1 edge selected`. 

### Delete

Select one or more items and press `Delete` or `Backspace`.

- **Root cannot be deleted.** This is intentional design.
- When you delete a parent, its children become orphans (no parent). They're still on the canvas, just disconnected. The Validate panel will flag them as R8 warnings.

### Undo and redo

History keeps **up to 10 steps** and is shared across every tab. Ctrl/Cmd+Z always undoes the most recent action, such as adding a node, renaming Main, or deleting a tab.

### Save and open

- **Save** downloads the current tree to your default download location. The format meaning is documented in [`bt-json-format.md`](./docs/bt-json-format.md).
- **Open** replaces the current tree. 
- If the file is malformed or fails validation, the toolbar shows an error and the current tree is kept.

### Export image

The **Export** button in the toolbar (next to **Save**) saves the **active tree** as a PNG image. A small dialog lets you choose:

- **Background:** **Themed background** (the current canvas color, light or dark — good for documentation screenshots) or **Transparent** (alpha channel, no background — good for dropping onto a slide).
- **File name:** prefilled as `<tree name>.png`. The `.png` extension is added automatically if you remove it.

The image always captures the **whole tree** at full bounds — not just what's visible — at 2× resolution. Editor-only chrome (the axis/origin overlays and the selected-node ring) is left out of the image. Press **Esc**, click outside the dialog, or **Cancel** to dismiss. Export is disabled for an empty tree.

### Multiple trees

A document can hold several behavior trees. The **tab bar** above the canvas is one tab per tree. The first tab **Main** is the document's entry point and cannot be deleted.

- **Switch trees:** Click a tab to switch to another tree's canvas.
- **Create a new tree:** Click the **+** button. **It sits at the right end of the tab bar**. New trees auto-name as `Tree 2`, `Tree 3`, …
- **Rename a tree:** Double-click the tab name. Renaming a tree also updates every `SubTree` node that referenced its old name.
- **Reorder tabs:** Drag a tab sideways and drop it where you want. You can also reorder with the keyboard — focus a tab with `Tab`, press `Space` to pick it up, move with the arrow keys, then `Space` to drop. Reordering is a single undo step.
- **Delete a tree:** Hover over a non-Main tab and click the **×** that appears on the right side. SubTree nodes that pointed at the deleted tree become invalid references and will surface as validation issues at save time.

### Subtrees

A **SubTree** node embeds another tree by reference. Select one to work with it in the property panel:

- **Tree Reference:** Pick which tree the SubTree points at from the dropdown (the current tree is excluded). A reference to a tree that no longer exists is highlighted as a warning.
- **Name is read-only.** A SubTree's name always mirrors the referenced tree's name, so you can't edit it directly here. To rename it, double-click the referenced tree's **tab** — the SubTree node updates to match. If there's no valid reference yet, the name shows `(no reference)`.
- **Open subtree ↗:** Click to jump to the referenced tree's tab. The button is disabled when the reference is unset or points at a missing tree.

### Move or copy nodes between trees

Select one or more nodes, then click **Move / Copy** in the toolbar to transfer them to another tree. The button is enabled only when you have a node selected **and** the document has at least two trees.

In the dialog:

- **Destination tree:** any tree except the current one, listed in tab order.
- **Move** removes the nodes from the current tree and adds them to the destination, keeping their IDs. **Copy** leaves the originals in place and adds fresh copies.
- The summary shows how many nodes and edges transfer. An edge that connects a selected node to an unselected one (a **boundary edge**) is dropped — the count is shown.
- After you confirm, the destination tab becomes active with the transferred nodes selected. A single `Ctrl/Cmd+Z` reverts the whole operation across both trees.

The action is blocked (with an inline message) when it would:

- move or copy a **Root** into a tree that already has one, or
- move or copy a **SubTree that references the destination**, which would create a cycle.

### Canvas controls

The control cluster in the **bottom-left** corner of the canvas holds the zoom and fit buttons plus a **zoom-level chip** showing the current zoom as a percentage. Click the chip to reset zoom to **100%** (your pan position is kept).

The **Layout** button in the toolbar reorganizes the active tree top-down and frames the whole tree in view.

### Validate

Click **Validate** in the toolbar. The bottom panel lists structural issues, errors first. Click a row to select the offending node on the canvas — the property panel jumps to it so you can fix it in place.

Validate is a point-in-time check; it does not run continuously. After you edit, run it again.

## Understanding validation rules

Each rule is documented in full in [`bt-json-format.md` §5](./docs/bt-json-format.md). 

Summaries:

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
